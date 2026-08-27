"""
Django management command to initialize application groups and permissions.

Usage: python manage.py init_groups

Idempotent: safely run multiple times.
"""

from __future__ import annotations

from typing import Any

from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand

from catalog.models import PlantSpecies
from finance.models import (
    PriceBook,
    PriceItem,
    ProjectBudget,
    QuoteVersion,
)
from identity.models import Client, Organization, User
from irrigation.models import IrrigationEstimate
from planning.models import Layout, LayoutVersion
from projects.models import Project, Site, SiteFeature, SiteVersion


class Command(BaseCommand):
    help = "Initialize application groups (admin, asesor, cliente) with DRF permissions."

    def handle(self, *args: Any, **options: Any) -> None:
        self.stdout.write("🔑 Initializing Django groups and permissions...")
        self.stdout.write()

        self._init_groups()
        self.stdout.write(self.style.SUCCESS("✓ Groups initialized."))

    def _init_groups(self) -> None:
        admin_group = self._get_or_create_group("admin")
        asesor_group = self._get_or_create_group("asesor")
        cliente_group = self._get_or_create_group("cliente")

        for group in [admin_group, asesor_group, cliente_group]:
            group.permissions.clear()

        self._add_admin_permissions(admin_group)
        self._add_asesor_permissions(asesor_group)
        self._add_cliente_permissions(cliente_group)

    def _get_or_create_group(self, name: str) -> Group:
        group, _ = Group.objects.get_or_create(name=name)
        return group

    def _add_permission(self, group: Group, model_class: type, perm: str) -> None:
        content_type = ContentType.objects.get_for_model(model_class)
        try:
            permission = Permission.objects.get(content_type=content_type, codename=perm)
            group.permissions.add(permission)
        except Permission.DoesNotExist:
            self.stdout.write(
                self.style.WARNING(f"  ⚠  Permission {perm} not found for {model_class.__name__}")
            )

    def _add_admin_permissions(self, admin_group: Group) -> None:
        models = [
            Organization,
            Client,
            Project,
            Site,
            SiteVersion,
            SiteFeature,
            Layout,
            LayoutVersion,
            PriceBook,
            ProjectBudget,
            User,
        ]
        perms = ["add", "change", "delete", "view"]

        for model in models:
            for perm in perms:
                self._add_permission(admin_group, model, f"{perm}_{model._meta.model_name}")

        self.stdout.write(self.style.SUCCESS("  ✓ Created admin group with full permissions"))

    def _add_asesor_permissions(self, asesor_group: Group) -> None:
        design_models = [Site, SiteVersion, SiteFeature, Layout, LayoutVersion, Project]
        for model in design_models:
            for perm in ["view", "change"]:
                self._add_permission(asesor_group, model, f"{perm}_{model._meta.model_name}")

        finance_models = [PriceBook, PriceItem, QuoteVersion, ProjectBudget]
        for model in finance_models:
            for perm in ["view"]:
                self._add_permission(asesor_group, model, f"{perm}_{model._meta.model_name}")

        self._add_permission(asesor_group, QuoteVersion, "add_quoteversion")
        self._add_permission(asesor_group, QuoteVersion, "change_quoteversion")

        read_only = [PlantSpecies, IrrigationEstimate]
        for model in read_only:
            self._add_permission(asesor_group, model, f"view_{model._meta.model_name}")

        self.stdout.write(
            self.style.SUCCESS("  ✓ Created asesor group with design + finance permissions")
        )

    def _add_cliente_permissions(self, cliente_group: Group) -> None:
        models = [Project, Site, SiteVersion, Layout, LayoutVersion, ProjectBudget, QuoteVersion]
        for model in models:
            self._add_permission(cliente_group, model, f"view_{model._meta.model_name}")

        self.stdout.write(
            self.style.SUCCESS("  ✓ Created cliente group with read-only permissions")
        )
