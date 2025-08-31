# api/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from users.models import CleanupReport
from users.serializers import CleanupReportSerializer
from users.tasks import cleanup_inactive_users
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .serializers import RegisterSerializer
from rest_framework.permissions import IsAuthenticated, IsAdminUser

User = get_user_model()

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


# Extend TokenObtainPairSerializer to include extra claims if desired
class login_serializers(TokenObtainPairSerializer):
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # add custom claims (optional)
        token['email'] = user.email
        return token

class login_serializers(TokenObtainPairView):
    
    serializer_class = login_serializers

    # override to update last_login
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        # if authentication successful, update last_login
        if response.status_code == 200:
            # TokenObtainPairSerializer validated credentials, fetch user
            username_field = User.USERNAME_FIELD if hasattr(User, 'USERNAME_FIELD') else 'username'
            # The serializer expects 'username' by default; consider email-login changes if needed
            username = request.data.get(username_field) or request.data.get('username')
            try:
                user = User.objects.get(**{username_field: username})
                user.last_login = timezone.now()
                user.save(update_fields=['last_login'])
            except User.DoesNotExist:
                pass
        return response


# api/views.py
import logging
import smtplib
from datetime import timedelta

from django.utils import timezone
from django.conf import settings
from django.template.loader import render_to_string
from django.core.mail import EmailMultiAlternatives
from django.core.cache import cache
from django.db import transaction

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from users.models import AppUser, CleanupReport
from users.serializers import CleanupReportSerializer

logger = logging.getLogger(__name__)

# Lock settings
CLEANUP_LOCK_KEY = "cleanup_inactive_lock_v1"
CLEANUP_LOCK_TTL = 60 * 60  # seconds, adjust if you expect longer runs

DEFAULT_CHUNK_SIZE = 1000  # tune to your DB capacity


def _send_cleanup_report_email_sync(report, deleted_users):
    """
    Synchronously send a cleanup report email. Returns dict status.
    (This runs inside the request, so keep it lightweight in production.)
    """
    try:
        recipients = getattr(settings, "CLEANUP_NOTIFICATION_RECIPIENTS", None)
        if not recipients:
            logger.info("No CLEANUP_NOTIFICATION_RECIPIENTS configured; skipping email send.")
            return {"status": "no_recipients", "report_id": report.id}

        if isinstance(recipients, str):
            recipients = [r.strip() for r in recipients.split(",") if r.strip()]

        context = {"report": report, "deleted_users": deleted_users}
        # try templates first
        try:
            text_body = render_to_string("emails/cleanup_report.txt", context)
        except Exception:
            text_body = (
                f"Cleanup Report - {report.timestamp}\n\n"
                f"Users deleted: {report.users_deleted}\n"
                f"Active users remaining: {report.active_users_remaining}\n\n"
                "Deleted users:\n"
                + "\n".join([f"{u['email']} (last_login={u['last_login']})" for u in deleted_users])
            )

        html_body = None
        try:
            html_body = render_to_string("emails/cleanup_report.html", context)
        except Exception:
            html_body = None

        subject = f"Cleanup Report — {report.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@example.com"),
            to=recipients,
        )
        if html_body:
            msg.attach_alternative(html_body, "text/html")

        msg.send()
        logger.info("Sent cleanup report email (report_id=%s) to %s", report.id, recipients)
        return {"status": "sent", "report_id": report.id, "recipients": recipients}

    except (smtplib.SMTPException, ConnectionError) as exc:
        logger.exception("SMTP/connection error when sending cleanup email (sync).")
        return {"status": "failed", "reason": str(exc)}
    except Exception as exc:
        logger.exception("Unexpected error sending cleanup email (sync).")
        return {"status": "failed", "reason": str(exc)}
# api/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework_simplejwt.authentication import JWTAuthentication

from users.models import CleanupReport
from users.serializers import CleanupReportSerializer

class LatestReportView(APIView):
    authentication_classes = [JWTAuthentication]


    def get(self, request):
        try:
            report = CleanupReport.objects.latest("timestamp")
        except CleanupReport.DoesNotExist:
            return Response({"detail": "No reports yet."}, status=status.HTTP_404_NOT_FOUND)

        serializer = CleanupReportSerializer(report)
        return Response(serializer.data)
    

email_info = None


class TriggerCleanupView(APIView):
    

    def post(self, request):
        """
        Synchronous bulk cleanup endpoint (no Celery).
        Optional query params:
          - days=<int>        -> inactivity threshold (overrides INACTIVITY_DAYS)
          - chunk_size=<int>  -> how many ids to delete per chunk (default 1000)

        This endpoint will:
          1) collect candidate users (email + last_login),
          2) delete them in chunks,
          3) create a CleanupReport,
          4) send a synchronous email report (if configured),
          5) return a JSON summary.
        """
        # parse query params
        days_param = request.query_params.get("days")
        chunk_param = request.query_params.get("chunk_size")

        inactivity_days = None
        chunk_size = DEFAULT_CHUNK_SIZE

        if days_param:
            try:
                inactivity_days = int(days_param)
                if inactivity_days < 0:
                    raise ValueError()
            except Exception:
                return Response({"detail": "`days` must be a non-negative integer."}, status=status.HTTP_400_BAD_REQUEST)

        if chunk_param:
            try:
                chunk_size = int(chunk_param)
                if chunk_size <= 0:
                    raise ValueError()
            except Exception:
                return Response({"detail": "`chunk_size` must be a positive integer."}, status=status.HTTP_400_BAD_REQUEST)

        # acquire lock to avoid concurrent manual runs
        try:
            got_lock = cache.add(CLEANUP_LOCK_KEY, "locked", CLEANUP_LOCK_TTL)
        except Exception:
            logger.exception("Cache access failed for cleanup lock; proceeding without lock.")
            got_lock = True  # allow run if cache broken (best-effort)

        if not got_lock:
            return Response({"detail": "Cleanup already running"}, status=status.HTTP_409_CONFLICT)

        try:
            # compute cutoff
            now = timezone.now()
            if inactivity_days is None:
                inactivity_days = int(getattr(settings, "INACTIVITY_DAYS", 30))
            cutoff = now - timedelta(days=inactivity_days)

            # build queryset: inactive flag OR last_login older than cutoff
            qs = (AppUser.objects.filter(is_active=False) | AppUser.objects.filter(last_login__lt=cutoff)).distinct()

            # collect candidates (id/email/last_login) BEFORE deleting
            candidates = list(qs.values("id", "email", "last_login"))
            total_candidates = len(candidates)

            if total_candidates == 0:
                # create a report with zero deletions
                active_remaining = AppUser.objects.filter(is_active=True).count()
                report = CleanupReport.objects.create(users_deleted=0, active_users_remaining=active_remaining)


                return Response(
                    {
                        "report_id": report.id,
                        "deleted": 0,
                        "active_remaining": active_remaining,
                        "deleted_users": [],

                    },
                    status=status.HTTP_200_OK,
                )

            # normalize last_login for JSON
            for u in candidates:
                if u.get("last_login") is None:
                    u["last_login"] = None
                else:
                    u["last_login"] = u["last_login"].isoformat()

            ids = [u["id"] for u in candidates]
            deleted_total = 0

            # perform deletes in transaction, chunked to avoid massive single-transaction costs
            try:
                with transaction.atomic():
                    for i in range(0, len(ids), chunk_size):
                        chunk = ids[i : i + chunk_size]
                        AppUser.objects.filter(id__in=chunk).delete()
                        deleted_total += len(chunk)

                    active_remaining = AppUser.objects.filter(is_active=True).count()

                    # create report row
                    report = CleanupReport.objects.create(users_deleted=deleted_total, active_users_remaining=active_remaining)
            except Exception as exc:
                logger.exception("Failed during bulk delete/create report transaction.")
                return Response({"detail": "Server error during cleanup.", "error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # send report email synchronously (no Celery)


            # return summary
            return Response(
                {
                    "report_id": report.id,
                    "deleted": deleted_total,
                    "active_remaining": active_remaining,
                    "deleted_users": candidates,

                },
                status=status.HTTP_200_OK,
            )

        finally:
            # release lock
            try:
                cache.delete(CLEANUP_LOCK_KEY)
            except Exception:
                logger.exception("Failed to release cleanup lock (ignored).")
