from __future__ import annotations

import json
from io import StringIO
from typing import Any

import pytest
from django.core.cache import cache
from django.core.management import CommandError, call_command
from rest_framework.test import APIClient

from identity.models import Client, Membership, Organization, User
from planning.models import LayoutVersion
from projects.models import Project, Site

DEMO_PASSWORD = "Demo-pass-914!"


@pytest.fixture
def demo_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """The test runner forces DEBUG off, so the seed runs behind the explicit opt-in."""
    monkeypatch.setenv("DEMO_USER_EMAIL", "demo@ruuf.local")
    monkeypatch.setenv("DEMO_USER_PASSWORD", DEMO_PASSWORD)
    monkeypatch.setenv("DEMO_SEED", "1")


def run_seed() -> dict[str, str]:
    """Run the demo seed and return the ids it prints."""
    output = StringIO()
    call_command("seed_demo", stdout=output)
    payload = output.getvalue()
    return dict(json.loads(payload[payload.index("{") : payload.rindex("}") + 1]))


@pytest.mark.django_db
def test_seed_demo_is_idempotent(demo_env: None) -> None:
    first = run_seed()
    second = run_seed()

    assert first == second
    assert User.objects.filter(email="demo@ruuf.local").count() == 1
    assert Organization.objects.count() == 1
    assert Client.objects.count() == 1
    assert Project.objects.count() == 1
    assert Site.objects.count() == 1
    assert (
        Membership.objects.get(
            user__email="demo@ruuf.local", organization_id=first["organization_id"]
        ).role
        == Membership.Role.OWNER
    )
    assert User.objects.get(email="demo@ruuf.local").check_password(DEMO_PASSWORD)


@pytest.mark.django_db
def test_seed_demo_requires_a_password_from_the_environment(
    demo_env: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("DEMO_USER_PASSWORD", raising=False)

    with pytest.raises(CommandError, match="DEMO_USER_PASSWORD is required"):
        call_command("seed_demo", verbosity=0)

    assert not User.objects.exists()


@pytest.mark.django_db
def test_seed_demo_rejects_a_weak_password(demo_env: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DEMO_USER_PASSWORD", "demo")

    with pytest.raises(CommandError, match="rejected by the password validators"):
        call_command("seed_demo", verbosity=0)

    assert not User.objects.exists()


@pytest.mark.django_db
def test_seed_demo_is_disabled_without_debug_or_opt_in(
    demo_env: None, monkeypatch: pytest.MonkeyPatch, settings: Any
) -> None:
    monkeypatch.delenv("DEMO_SEED", raising=False)
    assert settings.DEBUG is False

    with pytest.raises(CommandError, match="seed_demo is disabled"):
        call_command("seed_demo", verbosity=0)
    assert not User.objects.exists()

    settings.DEBUG = True
    call_command("seed_demo", verbosity=0)
    assert User.objects.filter(email="demo@ruuf.local").exists()


@pytest.mark.django_db
def test_seeded_demo_user_can_login_generate_plan_and_read_revisions(
    seeded_catalog: None, demo_env: None, valid_plan_payload: dict[str, object]
) -> None:
    cache.clear()
    seeded = run_seed()
    project_id = seeded["project_id"]

    client = APIClient(enforce_csrf_checks=True)
    login_token = client.get("/api/v1/auth/csrf").json()["csrf_token"]
    login = client.post(
        "/api/v1/auth/login",
        {"email": seeded["user_email"], "password": DEMO_PASSWORD},
        format="json",
        HTTP_X_CSRFTOKEN=login_token,
    )
    assert login.status_code == 200

    # Django rotates the CSRF token on login: a client must re-read it before writing.
    token = client.get("/api/v1/auth/csrf").json()["csrf_token"]
    assert token != login_token

    projects = client.get("/api/v1/projects/")
    assert projects.status_code == 200
    assert [item["id"] for item in projects.json()["results"]] == [project_id]

    generated = client.post(
        f"/api/v1/projects/{project_id}/generate-plan/",
        valid_plan_payload,
        format="json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert generated.status_code == 201
    layout_id = generated.json()["layout_id"]
    assert generated.json()["revision"] == 1

    revision_payload = {
        "base_revision": 1,
        "items": [{"plant_id": "lavender", "x_m": 2, "y_m": 2}],
    }
    created = client.post(
        f"/api/v1/layouts/{layout_id}/revisions/",
        revision_payload,
        format="json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert created.status_code == 201
    assert created.json()["revision"] == 2

    listed = client.get(f"/api/v1/layouts/{layout_id}/revisions/")
    assert listed.status_code == 200
    assert [item["revision"] for item in listed.json()["results"]] == [2, 1]

    filtered = client.get("/api/v1/layout-versions/", {"layout": layout_id})
    assert filtered.status_code == 200
    assert [item["revision"] for item in filtered.json()["results"]] == [2, 1]

    stale = client.post(
        f"/api/v1/layouts/{layout_id}/revisions/",
        revision_payload,
        format="json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "revision_conflict"
    # DRF renders every leaf of an exception detail as a string, so the client must coerce.
    assert stale.json()["error"]["details"]["current_revision"] == "2"
    assert stale.json()["error"]["details"]["expected_revision"] == "1"


@pytest.mark.django_db
def test_layout_version_filter_rejects_a_malformed_layout_id(
    seeded_catalog: None,
    api_client: APIClient,
    project: Project,
    valid_plan_payload: dict[str, object],
) -> None:
    api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    )
    assert LayoutVersion.objects.count() == 1

    response = api_client.get("/api/v1/layout-versions/", {"layout": "not-a-uuid"})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"


@pytest.mark.django_db
def test_layout_version_filter_hides_versions_of_another_layout(
    seeded_catalog: None,
    api_client: APIClient,
    project: Project,
    valid_plan_payload: dict[str, object],
) -> None:
    first = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    ).json()
    second = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    ).json()
    assert first["layout_id"] != second["layout_id"]

    response = api_client.get("/api/v1/layout-versions/", {"layout": first["layout_id"]})

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["results"]] == [first["layout_version_id"]]
