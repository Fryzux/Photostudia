from rest_framework.views import exception_handler
from rest_framework.exceptions import ValidationError
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from rest_framework.response import Response
from rest_framework import status

def custom_exception_handler(exc, context):
    # Call REST framework's default exception handler first,
    # to get the standard error response.
    response = exception_handler(exc, context)

    # Handle Django's structural ValidationErrors
    if isinstance(exc, DjangoValidationError):
        return Response({
            "error": "Validation Error",
            "details": exc.message_dict if hasattr(exc, 'message_dict') else exc.messages
        }, status=status.HTTP_400_BAD_REQUEST)

    # Handle Database Integrity Errors
    if isinstance(exc, IntegrityError):
        return Response({
            "error": "Database Integrity Error",
            "details": str(exc)
        }, status=status.HTTP_400_BAD_REQUEST)

    # If the response is not None, format it
    if response is not None:
        return Response({
            "error": "Error",
            "details": response.data
        }, status=response.status_code)

    # For any unmatched exceptions (HTTP 500)
    return Response({
        "error": "Internal Server Error",
        "details": str(exc)
    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
