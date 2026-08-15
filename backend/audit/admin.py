from __future__ import annotations

from django.contrib import admin

from audit.models import AuditEvent


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("created_at", "organization", "actor", "action", "object_type", "object_id")
    list_filter = ("organization", "action", "object_type")
    search_fields = ("request_id", "object_id", "actor__email")
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "organization",
        "actor",
        "request_id",
        "action",
        "object_type",
        "object_id",
        "changes",
        "reason",
    )
