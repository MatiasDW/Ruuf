from __future__ import annotations

from typing import Any

from django.http import HttpRequest

from audit.models import AuditEvent
from identity.models import Organization, User


def record_audit_event(
    *,
    organization: Organization,
    actor: User | None,
    action: str,
    instance: Any,
    request: HttpRequest | None = None,
    changes: dict[str, object] | None = None,
    reason: str = "",
) -> AuditEvent:
    return AuditEvent.objects.create(
        organization=organization,
        actor=actor if actor and actor.is_authenticated else None,
        request_id=getattr(request, "request_id", "") if request else "",
        action=action,
        object_type=instance._meta.label_lower,
        object_id=str(instance.pk),
        changes=changes or {},
        reason=reason,
    )
