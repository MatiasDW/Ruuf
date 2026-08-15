from __future__ import annotations

from django.db import models

from common.models import UUIDTimeStampedModel
from identity.models import Organization, User


class AuditEvent(UUIDTimeStampedModel):
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="audit_events"
    )
    actor = models.ForeignKey(
        User, on_delete=models.SET_NULL, related_name="audit_events", null=True, blank=True
    )
    request_id = models.CharField(max_length=64, blank=True, db_index=True)
    action = models.CharField(max_length=100)
    object_type = models.CharField(max_length=100)
    object_id = models.CharField(max_length=64)
    changes = models.JSONField(default=dict, blank=True)
    reason = models.CharField(max_length=250, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("organization", "created_at"))]
