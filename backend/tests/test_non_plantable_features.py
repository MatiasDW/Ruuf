from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from domain.planning import (
    FEATURE_CLEARANCE_M,
    Placement,
    RectangleObstacle,
    get_feature_clearance,
    validate_placement,
)
from projects.models import SiteFeature


@pytest.mark.django_db
def test_create_pool_feature(
    seeded_catalog: None, api_client: APIClient, project, valid_plan_payload: dict
) -> None:
    """Create a pool feature with rectangle geometry."""
    response = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    )
    assert response.status_code == 201
    site_version = project.site.versions.first()

    feature = SiteFeature.objects.create(
        site_version=site_version,
        feature_type="pool",
        label="Swimming Pool",
        geometry={
            "type": "rect",
            "x": 2.0,
            "y": 2.0,
            "width": 4.0,
            "height": 3.0,
        },
    )

    assert feature.feature_type == "pool"
    assert feature.geometry["type"] == "rect"


@pytest.mark.django_db
def test_create_quincho_feature(
    seeded_catalog: None, api_client: APIClient, project, valid_plan_payload: dict
) -> None:
    """Create a quincho feature with polygon geometry."""
    response = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    )
    assert response.status_code == 201
    site_version = project.site.versions.first()

    feature = SiteFeature.objects.create(
        site_version=site_version,
        feature_type="quincho",
        label="Garden Pergola",
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

    assert feature.feature_type == "quincho"
    assert feature.geometry["type"] == "polygon"


@pytest.mark.django_db
def test_create_terrace_feature(
    seeded_catalog: None, api_client: APIClient, project, valid_plan_payload: dict
) -> None:
    """Create a terrace feature."""
    response = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    )
    assert response.status_code == 201
    site_version = project.site.versions.first()

    feature = SiteFeature.objects.create(
        site_version=site_version,
        feature_type="terrace",
        label="Patio",
        geometry={
            "type": "rect",
            "x": 0.0,
            "y": 0.0,
            "width": 5.0,
            "height": 4.0,
        },
    )

    assert feature.feature_type == "terrace"


@pytest.mark.django_db
def test_create_path_feature(
    seeded_catalog: None, api_client: APIClient, project, valid_plan_payload: dict
) -> None:
    """Create a path feature (minimal clearance)."""
    response = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    )
    assert response.status_code == 201
    site_version = project.site.versions.first()

    feature = SiteFeature.objects.create(
        site_version=site_version,
        feature_type="path",
        label="Garden Path",
        geometry={
            "type": "rect",
            "x": 8.0,
            "y": 3.0,
            "width": 1.0,
            "height": 8.0,
        },
    )

    assert feature.feature_type == "path"


@pytest.mark.django_db
def test_feature_clearance_values() -> None:
    """Verify clearance distance for each feature type."""
    assert get_feature_clearance("pool") == 1.5
    assert get_feature_clearance("quincho") == 1.0
    assert get_feature_clearance("terrace") == 0.5
    assert get_feature_clearance("path") == 0.0
    assert get_feature_clearance("unknown") == 0.0


@pytest.mark.django_db
def test_feature_clearance_constant() -> None:
    """Verify FEATURE_CLEARANCE_M constant."""
    assert "pool" in FEATURE_CLEARANCE_M
    assert "quincho" in FEATURE_CLEARANCE_M
    assert "terrace" in FEATURE_CLEARANCE_M
    assert "path" in FEATURE_CLEARANCE_M
    assert FEATURE_CLEARANCE_M["pool"] == 1.5
    assert FEATURE_CLEARANCE_M["quincho"] == 1.0
    assert FEATURE_CLEARANCE_M["terrace"] == 0.5
    assert FEATURE_CLEARANCE_M["path"] == 0.0


def test_placement_rejected_inside_pool_clearance() -> None:
    """Motor rechaza cualquier planta dentro del clearance de una piscina."""
    obstacle = RectangleObstacle(
        x=2.0, y=2.0, width=2.0, height=2.0, label="Pool", feature_type="pool"
    )

    placement = Placement(
        plant_id="quillay",
        name="Quillay",
        x=3.0,
        y=3.0,
        clearance_radius_m=0.5,
        structure_clearance_m=0.0,
        water_need="low",
        liters_per_week=60.0,
        color="#7ea16b",
    )

    issues = validate_placement(
        placement,
        yard_width=10.0,
        yard_height=10.0,
        obstacles=[obstacle],
        other_placements=(),
    )

    assert len(issues) > 0, f"Expected clearance violation but none found: {issues}"
    assert any(
        issue.code == "structure_clearance" for issue in issues
    ), f"Expected structure_clearance violation, got: {[issue.code for issue in issues]}"
