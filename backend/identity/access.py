from __future__ import annotations

from collections.abc import Iterable
from uuid import UUID

from django.contrib.auth.models import AnonymousUser

from identity.models import Membership, User

DESIGN_ROLES = {Membership.Role.OWNER, Membership.Role.ADMIN, Membership.Role.DESIGNER}
FINANCE_ROLES = {Membership.Role.OWNER, Membership.Role.ADMIN, Membership.Role.FINANCE}
ADMIN_ROLES = {Membership.Role.OWNER, Membership.Role.ADMIN}


def has_organization_role(
    user: User | AnonymousUser,
    organization_id: UUID | str,
    roles: Iterable[str],
) -> bool:
    if not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return Membership.objects.filter(
        user=user,
        organization_id=organization_id,
        status=Membership.Status.ACTIVE,
        role__in=set(roles),
    ).exists()
