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
    """Extract the owning organization ID from any model instance.

    Handles both direct and nested relationships by trying paths in order:
    direct .id, .organization_id, .project.organization_id, etc.
    """
    match instance:
        case Organization():
            return instance.id
        case Membership() | Client() | Project() | PriceBook():
            return instance.organization_id
        case Site():
            return instance.project.organization_id
        case SiteVersion():
            return instance.site.project.organization_id
        case SiteFeature():
            return instance.site_version.site.project.organization_id
        case Layout():
            return instance.project.organization_id
        case LayoutVersion():
            return instance.layout.project.organization_id
        case LayoutItem():
            return instance.layout_version.layout.project.organization_id
        case ValidationIssue() | SolverRun() | IrrigationEstimate() | IrrigationZone():
            return instance.layout_version.layout.project.organization_id
        case PriceItem():
            return instance.price_book.organization_id
        case QuoteVersion():
            return instance.project.organization_id
        case QuoteItem():
            return instance.quote.project.organization_id
        case ProjectBudget() | Expense():
            return instance.project.organization_id
        case PlantSpecies() | PlantCultivar() | PlantRuleVersion():
            return None
        case _:
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
