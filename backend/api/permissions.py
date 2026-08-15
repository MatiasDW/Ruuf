from __future__ import annotations

from uuid import UUID

from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.request import Request

from catalog.models import PlantCultivar, PlantRuleVersion, PlantSpecies
from finance.models import (
    Expense,
    PriceBook,
    PriceItem,
    ProjectBudget,
    QuoteItem,
    QuoteVersion,
)
from identity.access import DESIGN_ROLES, has_organization_role
from identity.models import Client, Membership, Organization
from irrigation.models import IrrigationEstimate, IrrigationZone
from planning.models import Layout, LayoutItem, LayoutVersion, SolverRun, ValidationIssue
from projects.models import Project, Site, SiteFeature, SiteVersion


def organization_id_for(instance: object) -> UUID | None:
    if isinstance(instance, Organization):
        return instance.id
    if isinstance(instance, Membership | Client | Project | PriceBook):
        return instance.organization_id
    if isinstance(instance, Site):
        return instance.project.organization_id
    if isinstance(instance, SiteVersion):
        return instance.site.project.organization_id
    if isinstance(instance, SiteFeature):
        return instance.site_version.site.project.organization_id
    if isinstance(instance, Layout):
        return instance.project.organization_id
    if isinstance(instance, LayoutVersion):
        return instance.layout.project.organization_id
    if isinstance(instance, LayoutItem):
        return instance.layout_version.layout.project.organization_id
    if isinstance(instance, ValidationIssue | SolverRun | IrrigationEstimate | IrrigationZone):
        return instance.layout_version.layout.project.organization_id
    if isinstance(instance, PriceItem):
        return instance.price_book.organization_id
    if isinstance(instance, QuoteVersion):
        return instance.project.organization_id
    if isinstance(instance, QuoteItem):
        return instance.quote.project.organization_id
    if isinstance(instance, ProjectBudget | Expense):
        return instance.project.organization_id
    if isinstance(instance, PlantSpecies | PlantCultivar | PlantRuleVersion):
        return None
    return None


class OrganizationRolePermission(BasePermission):
    def has_object_permission(self, request: Request, view: object, obj: object) -> bool:
        if request.method in SAFE_METHODS:
            return True
        organization_id = organization_id_for(obj)
        if organization_id is None:
            return False
        roles = getattr(view, "write_roles", DESIGN_ROLES)
        return has_organization_role(request.user, organization_id, roles)
