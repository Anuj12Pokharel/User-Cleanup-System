from django.db import models
from django.utils import timezone

class AppUser(models.Model):   # use AUTH_USER_MODEL if intended to be real user
    email = models.CharField(max_length=255, unique=True)
    last_login = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'app_user'
        managed = True

    def __str__(self):
        return self.email

class CleanupReport(models.Model):
    timestamp = models.DateTimeField(default=timezone.now)
    users_deleted = models.IntegerField()
    active_users_remaining = models.IntegerField()

    class Meta:
        db_table = 'cleanup_report'
        managed = True


    def __str__(self):
        return f"{self.timestamp.isoformat()} - deleted: {self.users_deleted}"

