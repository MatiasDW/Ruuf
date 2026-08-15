from __future__ import annotations

from typing import Any

from rest_framework.response import Response
from rest_framework.views import exception_handler


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    response = exception_handler(exc, context)
    if response is None:
        return None

    request = context.get("request")
    request_id = getattr(request, "request_id", None)
    details = response.data
    code = "invalid_request" if response.status_code == 400 else "request_failed"
    if response.status_code == 401:
        code = "authentication_required"
    elif response.status_code == 403:
        code = "permission_denied"
    elif response.status_code == 404:
        code = "not_found"
    elif response.status_code == 409:
        code = "revision_conflict"

    response.data = {
        "error": {
            "code": code,
            "message": "The request could not be completed.",
            "details": details,
            "request_id": request_id,
        }
    }
    return response
