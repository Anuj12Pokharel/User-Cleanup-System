
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework import serializers
from users.models import CleanupReport

User = get_user_model()

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password')

    def create(self, validated_data):
        # create_user hashes the password correctly
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
        )
        return user



class CleanupReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = CleanupReport
        fields = '__all__'
