from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from domain.geometry import rect_to_polygon
from projects.models import SiteFeature


@pytest.mark.django_db
def test_create_polygon_feature(
    seeded_catalog: None, api_client: APIClient, project, valid_plan_payload: dict
) -> None:
    """Create a polygon feature with valid points."""
    response = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    )
    assert response.status_code == 201, f"Plan generation failed: {response.data}"
    site_version = project.site.versions.first()

    feature = SiteFeature.objects.create(
        site_version=site_version,
        feature_type="house",
        label="Polygon House",
        geometry={
            "type": "polygon",
            "points": [
                {"x": 1.0, "y": 1.0},
                {"x": 3.0, "y": 1.0},
                {"x": 3.0, "y": 3.0},
                {"x": 1.0, "y": 3.0},
            ],
        },
    )

    assert feature.geometry["type"] == "polygon"
    assert len(feature.geometry["points"]) == 4


@pytest.mark.django_db
def test_reject_polygon_with_less_than_3_points(
    seeded_catalog: None, api_client: APIClient, project, valid_plan_payload: dict
) -> None:
    """Polygon with <3 points should be rejected by serializer."""
    response = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    )
    assert response.status_code == 201
    site_version = project.site.versions.first()

    from api.serializers import SiteFeatureSerializer

    serializer = SiteFeatureSerializer(
        data={
            "site_version": site_version.id,
            "feature_type": "house",
            "label": "Invalid Polygon",
            "geometry": {
                "type": "polygon",
                "points": [
                    {"x": 1.0, "y": 1.0},
                    {"x": 2.0, "y": 2.0},
                ],
            },
        }
    )

    assert not serializer.is_valid()
    assert "points" in serializer.errors


@pytest.mark.django_db
def test_reject_self_intersecting_polygon(
    seeded_catalog: None, api_client: APIClient, project, valid_plan_payload: dict
) -> None:
    """Self-intersecting polygon should be rejected by serializer."""
    response = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    )
    assert response.status_code == 201
    site_version = project.site.versions.first()

    from api.serializers import SiteFeatureSerializer

    serializer = SiteFeatureSerializer(
        data={
            "site_version": site_version.id,
            "feature_type": "house",
            "label": "Invalid Polygon",
            "geometry": {
                "type": "polygon",
                "points": [
                    {"x": 0.0, "y": 0.0},
                    {"x": 2.0, "y": 2.0},
                    {"x": 2.0, "y": 0.0},
                    {"x": 0.0, "y": 2.0},
                ],
            },
        }
    )

    assert not serializer.is_valid()
    assert "points" in serializer.errors


@pytest.mark.django_db
def test_polygon_outside_site_boundaries(
    seeded_catalog: None, api_client: APIClient, project, valid_plan_payload: dict
) -> None:
    """Polygon with points outside site boundaries should be rejected."""
    response = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    )
    assert response.status_code == 201
    site_version = project.site.versions.first()

    from api.serializers import SiteFeatureSerializer

    serializer = SiteFeatureSerializer(
        data={
            "site_version": site_version.id,
            "feature_type": "house",
            "label": "Out of Bounds",
            "geometry": {
                "type": "polygon",
                "points": [
                    {"x": 0.0, "y": 0.0},
                    {"x": 100.0, "y": 0.0},
                    {"x": 100.0, "y": 100.0},
                ],
            },
        }
    )

    assert not serializer.is_valid()
    assert "points" in serializer.errors


@pytest.mark.django_db
def test_rect_still_accepted(
    seeded_catalog: None, api_client: APIClient, project, valid_plan_payload: dict
) -> None:
    """Rectangle geometry should still be accepted for backward compatibility."""
    response = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    )
    assert response.status_code == 201
    site_version = project.site.versions.first()

    feature = SiteFeature.objects.create(
        site_version=site_version,
        feature_type="house",
        label="Rect House",
        geometry={
            "type": "rect",
            "x": 1.0,
            "y": 1.0,
            "width": 3.0,
            "height": 2.0,
        },
    )

    assert feature.geometry["type"] == "rect"
    assert feature.geometry["width"] == 3.0


@pytest.mark.django_db
def test_migration_converts_existing_rects() -> None:
    """Data migration converts existing rect geometry to polygon."""
    rect = {"x": 0.0, "y": 0.0, "width": 4.0, "height": 3.0}
    polygon = rect_to_polygon(rect)

    assert polygon["type"] == "polygon"
    assert len(polygon["points"]) == 4
    assert polygon["points"][0] == {"x": 0.0, "y": 0.0}
    assert polygon["points"][1] == {"x": 4.0, "y": 0.0}
    assert polygon["points"][2] == {"x": 4.0, "y": 3.0}
    assert polygon["points"][3] == {"x": 0.0, "y": 3.0}
