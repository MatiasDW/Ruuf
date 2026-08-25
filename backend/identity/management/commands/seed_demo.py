from __future__ import annotations

import json
import os
from typing import Any

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from identity.models import Client, Membership, Organization, User
from projects.models import Project, Site

DEFAULT_USER_EMAIL = "demo@ruuf.local"
DEFAULT_USER_NAME = "Demo Ruuf"
DEFAULT_ORGANIZATION_NAME = "Ruuf Demo"
DEFAULT_ORGANIZATION_SLUG = "ruuf-demo"
DEFAULT_CLIENT_NAME = "Cliente Demo"
DEFAULT_PROJECT_NAME = "Casa Demo Lo Barnechea"


def _flag(name: str) -> bool:
    return os.getenv(name, "0").strip().lower() in {"1", "true", "yes"}


def seed_is_enabled() -> bool:
    """The demo bootstrap only runs in development or behind an explicit opt-in."""
    return bool(settings.DEBUG) or _flag("DEMO_SEED")


class Command(BaseCommand):
    help = (
        "Create or refresh the minimal demo tenant (user, organization, owner membership, "
        "client, project and site) so the frontend can consume /api/v1. Credentials come from "
        "DEMO_USER_EMAIL and DEMO_USER_PASSWORD; no password is ever hardcoded."
    )

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        if not seed_is_enabled():
            raise CommandError(
                "seed_demo is disabled. Run it with DJANGO_DEBUG=1 or set DEMO_SEED=1."
            )

        email = os.getenv("DEMO_USER_EMAIL", DEFAULT_USER_EMAIL).strip().lower()
        password = os.getenv("DEMO_USER_PASSWORD", "")
        if not email:
            raise CommandError("DEMO_USER_EMAIL cannot be empty.")
        if not password:
            raise CommandError(
                "DEMO_USER_PASSWORD is required; this command never ships a default password."
            )

        user, _ = User.objects.get_or_create(
            email=email,
            defaults={"display_name": os.getenv("DEMO_USER_NAME", DEFAULT_USER_NAME)},
        )
        try:
            validate_password(password, user)
        except ValidationError as error:
            raise CommandError(
                "DEMO_USER_PASSWORD rejected by the password validators: "
                + " ".join(error.messages)
            ) from error
        user.set_password(password)
        user.is_active = True
        user.save(update_fields=("password", "is_active"))

        organization, _ = Organization.objects.update_or_create(
            slug=os.getenv("DEMO_ORG_SLUG", DEFAULT_ORGANIZATION_SLUG),
            defaults={
                "name": os.getenv("DEMO_ORG_NAME", DEFAULT_ORGANIZATION_NAME),
                "is_active": True,
            },
        )
        Membership.objects.update_or_create(
            user=user,
            organization=organization,
            defaults={
                "role": Membership.Role.OWNER,
                "status": Membership.Status.ACTIVE,
            },
        )
        client, _ = Client.objects.update_or_create(
            organization=organization,
            display_name=DEFAULT_CLIENT_NAME,
            defaults={"is_active": True},
        )
        project, _ = Project.objects.update_or_create(
            organization=organization,
            name=os.getenv("DEMO_PROJECT_NAME", DEFAULT_PROJECT_NAME),
            defaults={
                "client": client,
                "assigned_to": user,
                "status": Project.Status.DESIGN,
                "output_level": Project.OutputLevel.PRELIMINARY,
            },
        )
        site, _ = Site.objects.update_or_create(
            project=project,
            defaults={
                "commune": "Lo Barnechea",
                "region": "Región Metropolitana",
                "country": "CL",
                "location_precision": "approximate",
            },
        )

        if options.get("verbosity", 1):
            self.stdout.write(
                json.dumps(
                    {
                        "user_id": str(user.id),
                        "user_email": user.email,
                        "organization_id": str(organization.id),
                        "organization_slug": organization.slug,
                        "client_id": str(client.id),
                        "project_id": str(project.id),
                        "site_id": str(site.id),
                    },
                    indent=2,
                )
            )
            self.stdout.write(self.style.SUCCESS("Demo tenant ready."))
