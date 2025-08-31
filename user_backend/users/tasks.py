# users/tasks.py
import logging
from celery import shared_task
from django.utils import timezone
from django.conf import settings
from datetime import timedelta
from django.db import transaction
from django.db.models import Q
from django.core.cache import cache

from .models import AppUser, CleanupReport

logger = logging.getLogger('users.tasks')

# Configurable defaults (override in settings.py if needed)
DEFAULT_THRESHOLD_DAYS = int(getattr(settings, "INACTIVITY_DAYS", 30))
DEFAULT_CHUNK_SIZE = int(getattr(settings, "CLEANUP_CHUNK_SIZE", 1000))
CLEANUP_LOCK_KEY = getattr(settings, "CLEANUP_LOCK_KEY", "cleanup_inactive_lock_v1")
CLEANUP_LOCK_TTL = int(getattr(settings, "CLEANUP_LOCK_TTL", 60 * 60))  # seconds


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def cleanup_inactive_users(self, threshold_days=None, chunk_size=None, dry_run=False):
    """
    Celery task to delete inactive users in chunks and create a CleanupReport.

    Params:
      - threshold_days: override inactivity threshold (days)
      - chunk_size: number of IDs to delete per DB operation
      - dry_run: if True, does not delete, only returns counts and a small sample

    NOTE: This task no longer sends any emails.
    """
    got_lock = False
    try:
        # Acquire a simple cache lock to avoid concurrent runs (best-effort)
        try:
            got_lock = cache.add(CLEANUP_LOCK_KEY, "locked", CLEANUP_LOCK_TTL)
            if not got_lock:
                logger.warning("cleanup_inactive_users: another run is in progress. Aborting.")
                return {"status": "locked"}
        except Exception:
            # If cache unavailable, log and proceed (risky in multi-worker setups)
            logger.exception("Cache access failed while acquiring cleanup lock; proceeding without lock.")
            got_lock = True

        now = timezone.now()
        threshold_days = int(threshold_days) if threshold_days is not None else DEFAULT_THRESHOLD_DAYS
        chunk_size = int(chunk_size) if chunk_size is not None else DEFAULT_CHUNK_SIZE
        cutoff = now - timedelta(days=threshold_days)

        # Build candidate queryset: inactive OR last_login older than cutoff
        qs = AppUser.objects.filter(Q(is_active=False) | Q(last_login__lt=cutoff)).order_by("id")
        total_candidates = qs.count()
        logger.info("cleanup_inactive_users: found %d candidate(s) (threshold=%d days)", total_candidates, threshold_days)

        if total_candidates == 0:
            active_remaining = AppUser.objects.filter(is_active=True).count()
            report = CleanupReport.objects.create(users_deleted=0, active_users_remaining=active_remaining)
            return {"report_id": report.id, "deleted": 0, "active_remaining": active_remaining}

        # If dry-run, return count and a small sample of emails (no deletion)
        if dry_run:
            sample = list(qs.values_list("email", flat=True)[:min(100, total_candidates)])
            return {"status": "dry_run", "candidates": total_candidates, "sample": sample}

        # Iterate IDs and delete in chunks to avoid huge transactions / memory usage
        ids_iter = qs.values_list("id", flat=True).iterator()
        deleted_total = 0
        current_chunk = []
        for uid in ids_iter:
            current_chunk.append(uid)
            if len(current_chunk) >= chunk_size:
                with transaction.atomic():
                    deleted_count = AppUser.objects.filter(id__in=current_chunk).delete()[0]
                    deleted_total += deleted_count
                current_chunk = []

        # delete any leftover chunk
        if current_chunk:
            with transaction.atomic():
                deleted_count = AppUser.objects.filter(id__in=current_chunk).delete()[0]
                deleted_total += deleted_count

        active_remaining = AppUser.objects.filter(is_active=True).count()

        # create a report row
        report = CleanupReport.objects.create(users_deleted=deleted_total, active_users_remaining=active_remaining)

        logger.info("cleanup_inactive_users: completed. deleted=%d active_remaining=%d report_id=%s",
                    deleted_total, active_remaining, report.id)

        return {"report_id": report.id, "deleted": deleted_total, "active_remaining": active_remaining}

    except Exception as exc:
        logger.exception("cleanup_inactive_users failed")
        raise self.retry(exc=exc)
    finally:
        # release lock if we set it
        try:
            if got_lock:
                cache.delete(CLEANUP_LOCK_KEY)
        except Exception:
            logger.exception("Failed to release cleanup lock (ignored).")
