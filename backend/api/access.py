from __future__ import annotations

from collections.abc import Iterable
from uuid import UUID

from django.contrib.auth.models import AnonymousUser
from django.db.models import QuerySet
from rest_framework.exceptions import PermissionDenied

from identity.access import has_organization_role
from identity.models import Membership, User


def organization_ids_for(
    user: User | AnonymousUser, roles: Iterable[str] | None = None
) -> QuerySet[Membership, UUID]:
    if not user.is_authenticated:
        return Membership.objects.none().values_list("organization_id", flat=True)
    memberships = Membership.objects.filter(user=user, status=Membership.Status.ACTIVE)
    if roles is not None:
        memberships = memberships.filter(role__in=set(roles))
    return memberships.values_list("organization_id", flat=True)


def require_role(user: User, organization_id: UUID | str, roles: Iterable[str]) -> None:
    if not has_organization_role(user, organization_id, roles):
        raise PermissionDenied("Your organization role does not allow this operation.")
