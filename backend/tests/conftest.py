from __future__ import annotations

from collections.abc import Callable
from typing import Any

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from identity.models import Membership, Organization, User
from projects.models import Project


@pytest.fixture
def seeded_catalog(db: object) -> None:
    call_command("seed_catalog", verbosity=0)


@pytest.fixture
def seeded_groups(db: object) -> None:
    call_command("init_groups", verbosity=0)


@pytest.fixture
def user(db: object) -> User:
    return User.objects.create_user(
        email="owner@example.com", password="Strong-pass-482!", display_name="Owner"
    )


@pytest.fixture
def organization(user: User) -> Organization:
    organization = Organization.objects.create(name="Terralta", slug="terralta")
    Membership.objects.create(
        user=user,
        organization=organization,
        role=Membership.Role.OWNER,
        status=Membership.Status.ACTIVE,
    )
    return organization


@pytest.fixture
def project(organization: Organization) -> Project:
    return Project.objects.create(organization=organization, name="Casa Lo Barnechea")


@pytest.fixture
def api_client(user: User) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def user_factory(db: object) -> Callable[..., User]:
    def factory(**overrides: Any) -> User:
        sequence = User.objects.count() + 1
        values = {
            "email": f"user-{sequence}@example.com",
            "password": "Strong-pass-482!",
            "display_name": f"User {sequence}",
        }
        values.update(overrides)
        return User.objects.create_user(**values)

    return factory


@pytest.fixture
def layout(project):
    from planning.models import Layout
    return Layout.objects.create(project=project, name="Test Layout")


@pytest.fixture
def valid_plan_payload() -> dict[str, object]:
    return {
        "site": {
            "yard_width": 18,
            "yard_height": 12,
            "sunlight": "full_sun",
            "style": "native",
            "location": {"commune": "Lo Barnechea", "region": "RM", "country": "CL"},
        },
        "irrigation": {
            "water_price_clp_per_m3": 1200,
            "sewer_price_clp_per_m3": 350,
            "fixed_charge_clp": 3000,
            "efficiency": 0.85,
        },
        "requests": [
            {"plant_id": "quillay", "quantity": 1},
            {"plant_id": "lavender", "quantity": 3},
        ],
        "obstacles": [{"x": 7, "y": 4, "width": 4, "height": 3, "label": "House"}],
    }
