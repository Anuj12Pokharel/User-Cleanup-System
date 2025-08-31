
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    RegisterView,
    login_serializers,
    LatestReportView,
    TriggerCleanupView,
)

urlpatterns = [

    path('register/', RegisterView.as_view(), name='register'),
    path('login/', login_serializers.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),


    path('reports/latest/', LatestReportView.as_view(), name='latest-report'),
    path('cleanup/trigger/', TriggerCleanupView.as_view(), name='trigger-cleanup'),
]
