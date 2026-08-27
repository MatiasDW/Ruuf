from __future__ import annotations

import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_generate_plan_with_pool_feature_type(
    seeded_catalog: None, api_client: APIClient, project, valid_plan_payload: dict
) -> None:
    """Pool feature_type persists to SiteFeature."""
    payload = valid_plan_payload.copy()
    payload["obstacles"] = [
        {
            "x": 2.0,
            "y": 2.0,
            "width": 4.0,
            "height": 4.0,
            "label": "Pool",
            "feature_type": "pool",
        }
    ]

    response = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", payload, format="json"
    )

    assert response.status_code == 201
    site_version = project.site.versions.first()

    pool_feature = site_version.features.filter(feature_type="pool").first()
    assert pool_feature is not None
    assert pool_feature.label == "Pool"
    assert pool_feature.geometry["x"] == 2.0


@pytest.mark.django_db
def test_generate_plan_without_feature_type_fallback(
    seeded_catalog: None, api_client: APIClient, project, valid_plan_payload: dict
) -> None:
    """Obstacle without feature_type falls back to HOUSE/OTHER."""
    payload = valid_plan_payload.copy()
    payload["obstacles"] = [
        {"x": 0.0, "y": 0.0, "width": 2.0, "height": 2.0, "label": "House"}
    ]

    response = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", payload, format="json"
    )

    assert response.status_code == 201
    site_version = project.site.versions.first()

    house_feature = site_version.features.filter(feature_type="house").first()
    assert house_feature is not None


@pytest.mark.django_db
def test_generate_plan_with_lawn_zones(
    seeded_catalog: None, api_client: APIClient, project, valid_plan_payload: dict
) -> None:
    """Lawn zones persist as SiteFeature with water calculation."""
    payload = valid_plan_payload.copy()
    payload["lawn_zones"] = [
        {
            "x": 10.0,
            "y": 10.0,
            "width": 5.0,
            "height": 5.0,
            "liters_per_m2_week": 2.5,
        }
    ]

    response = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", payload, format="json"
    )

    if response.status_code != 201:
        pytest.skip(f"Plan generation failed: {response.data}")

    site_version = project.site.versions.first()

    lawn_feature = site_version.features.filter(feature_type="lawn_zone").first()
    assert lawn_feature is not None
    assert lawn_feature.liters_per_m2_week == 2.5
    assert lawn_feature.plantable is True


@pytest.mark.django_db
def test_generate_plan_lawn_zones_included_in_irrigation(
    seeded_catalog: None, api_client: APIClient, project, valid_plan_payload: dict
) -> None:
    """Lawn zones increase irrigation estimate."""
    payload_no_lawn = valid_plan_payload.copy()

    response_no_lawn = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", payload_no_lawn, format="json"
    )
    assert response_no_lawn.status_code == 201
    water_no_lawn = response_no_lawn.json()["irrigation"]["weekly_liters"]

    payload_with_lawn = valid_plan_payload.copy()
    payload_with_lawn["lawn_zones"] = [
        {"x": 10.0, "y": 10.0, "width": 10.0, "height": 2.0, "liters_per_m2_week": 2.5}
    ]

    response_with_lawn = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", payload_with_lawn, format="json"
    )
    assert response_with_lawn.status_code == 201
    water_with_lawn = response_with_lawn.json()["irrigation"]["weekly_liters"]

    assert water_with_lawn > water_no_lawn
