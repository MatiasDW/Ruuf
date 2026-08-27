from __future__ import annotations

import json
import os
from typing import Any

from django.conf import settings
from django.contrib.auth.models import Group
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from identity.models import Client, Membership, Organization, User
from projects.models import Project, Site

DEMO_PROFILES = [
    {
        "email_env": "DEMO_ADMIN_EMAIL",
        "password_env": "DEMO_ADMIN_PASSWORD",
        "name": "Admin Demo",
        "group": "admin",
        "role": Membership.Role.OWNER,
        "default_email": "admin@ruuf.local",
    },
    {
        "email_env": "DEMO_ASESOR_EMAIL",
        "password_env": "DEMO_ASESOR_PASSWORD",
        "name": "Asesor Demo",
        "group": "asesor",
        "role": Membership.Role.DESIGNER,
        "default_email": "asesor@ruuf.local",
    },
    {
        "email_env": "DEMO_CLIENTE_EMAIL",
        "password_env": "DEMO_CLIENTE_PASSWORD",
        "name": "Cliente Demo",
        "group": "cliente",
        "role": Membership.Role.VIEWER,
        "default_email": "cliente@ruuf.local",
    },
]

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
        "Create or refresh demo tenant with 3 profiles (admin, asesor, cliente) "
        "in separate groups with different role. Passwords from env vars; none hardcoded."
    )

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        if not seed_is_enabled():
            raise CommandError(
                "seed_demo is disabled. Run it with DJANGO_DEBUG=1 or set DEMO_SEED=1."
            )

        call_command("init_groups", verbosity=0)

        organization, _ = Organization.objects.update_or_create(
            slug=os.getenv("DEMO_ORG_SLUG", DEFAULT_ORGANIZATION_SLUG),
            defaults={
                "name": os.getenv("DEMO_ORG_NAME", DEFAULT_ORGANIZATION_NAME),
                "is_active": True,
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

        demo_users = []
        for profile in DEMO_PROFILES:
            email = os.getenv(profile["email_env"], profile["default_email"]).strip().lower()
            password = os.getenv(profile["password_env"], "")

            if not email:
                raise CommandError(f"{profile['email_env']} cannot be empty.")
            if not password:
                raise CommandError(
                    f"{profile['password_env']} is required; never ships default passwords."
                )

            user, _ = User.objects.get_or_create(
                email=email,
                defaults={"display_name": profile["name"]},
            )
            try:
                validate_password(password, user)
            except ValidationError as error:
                raise CommandError(
                    f"{profile['password_env']} rejected: {' '.join(error.messages)}"
                ) from error

            user.set_password(password)
            user.is_active = True
            user.save(update_fields=("password", "is_active"))

            Membership.objects.update_or_create(
                user=user,
                organization=organization,
                defaults={
                    "role": profile["role"],
                    "status": Membership.Status.ACTIVE,
                },
            )

            group = Group.objects.get(name=profile["group"])
            user.groups.add(group)

            demo_users.append(
                {
                    "user_id": str(user.id),
                    "user_email": user.email,
                    "group": profile["group"],
                    "role": profile["role"],
                }
            )

            if project.assigned_to is None:
                project.assigned_to = user
                project.save(update_fields=("assigned_to",))

        if options.get("verbosity", 1):
            self.stdout.write(
                json.dumps(
                    {
                        "organization_id": str(organization.id),
                        "organization_slug": organization.slug,
                        "client_id": str(client.id),
                        "project_id": str(project.id),
                        "site_id": str(site.id),
                        "demo_users": demo_users,
                    },
                    indent=2,
                )
            )
            self.stdout.write(self.style.SUCCESS("Demo tenant ready with 3 profiles."))
