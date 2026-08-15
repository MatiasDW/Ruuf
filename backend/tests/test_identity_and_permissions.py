from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from identity.models import Membership, Organization, User


@pytest.mark.django_db
def test_user_can_create_organization_and_becomes_owner(user: User, api_client: APIClient) -> None:
    response = api_client.post(
        "/api/v1/organizations/",
        {"name": "New Studio", "slug": "new-studio"},
        format="json",
    )

    assert response.status_code == 201
    assert Membership.objects.filter(
        user=user,
        organization_id=response.json()["id"],
        role=Membership.Role.OWNER,
        status=Membership.Status.ACTIVE,
    ).exists()


@pytest.mark.django_db
def test_session_login_uses_csrf_cookie(user: User) -> None:
    client = APIClient(enforce_csrf_checks=True)
    csrf_response = client.get("/api/v1/auth/csrf")
    token = csrf_response.json()["csrf_token"]

    response = client.post(
        "/api/v1/auth/login",
        {"email": user.email, "password": "Strong-pass-482!"},
        format="json",
        HTTP_X_CSRFTOKEN=token,
    )

    assert response.status_code == 200
    assert response.json()["email"] == user.email
    assert client.get("/api/v1/auth/me").status_code == 200


@pytest.mark.django_db
def test_viewer_cannot_create_project(organization: Organization, user_factory, user: User) -> None:
    viewer = user_factory(email="viewer@example.com", display_name="Viewer")
    Membership.objects.create(
        user=viewer,
        organization=organization,
        role=Membership.Role.VIEWER,
        status=Membership.Status.ACTIVE,
    )
    client = APIClient()
    client.force_authenticate(user=viewer)

    response = client.post(
        "/api/v1/projects/",
        {"organization": str(organization.id), "name": "Forbidden"},
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_tenant_data_is_not_visible_to_other_organization(
    organization: Organization, project, user_factory
) -> None:
    outsider = user_factory(email="outside@example.com", display_name="Outside")
    other = Organization.objects.create(name="Other", slug="other")
    Membership.objects.create(
        user=outsider,
        organization=other,
        role=Membership.Role.OWNER,
        status=Membership.Status.ACTIVE,
    )
    client = APIClient()
    client.force_authenticate(user=outsider)

    response = client.get(f"/api/v1/projects/{project.id}/")

    assert response.status_code == 404
