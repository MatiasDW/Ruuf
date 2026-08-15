from __future__ import annotations

from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def health_view(request: object) -> JsonResponse:
    database_status = "ok"
    cache_status = "ok"
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        database_status = "unavailable"

    try:
        cache.set("health", "ok", timeout=5)
        if cache.get("health") != "ok":
            cache_status = "unavailable"
    except Exception:
        cache_status = "unavailable"

    status = "ok" if database_status == "ok" else "degraded"
    return JsonResponse(
        {
            "status": status,
            "database": database_status,
            "redis": cache_status,
            "stitch": "design_tool_only",
        }
    )
