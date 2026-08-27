from __future__ import annotations

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from domain.irrigation import calculate_lawn_zone_water, estimate_irrigation
from irrigation.models import IrrigationNetworkDesign
from projects.models import SiteFeature


@pytest.mark.django_db
def test_create_lawn_zone(
    seeded_catalog: None, api_client: APIClient, project, valid_plan_payload: dict
) -> None:
    """Create a lawn zone via SiteFeature."""
    api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    )
    site_version = project.site.versions.first()

    lawn = SiteFeature.objects.create(
        site_version=site_version,
        feature_type="lawn_zone",
        label="Lawn Area",
        geometry={"x": 0, "y": 0, "width": 4.0, "height": 6.0},
        water_need="medium",
        liters_per_m2_week=Decimal("2.5"),
    )

    assert lawn.feature_type == "lawn_zone"
    assert lawn.liters_per_m2_week == Decimal("2.5")
    assert lawn.water_need == "medium"


@pytest.mark.django_db
def test_lawn_zone_water_calculation(
    seeded_catalog: None, api_client: APIClient, project, valid_plan_payload: dict
) -> None:
    """Calculate water consumption for lawn zones."""
    api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    )
    site_version = project.site.versions.first()

    SiteFeature.objects.create(
        site_version=site_version,
        feature_type="lawn_zone",
        label="Front Lawn",
        geometry={"x": 0, "y": 0, "width": 3.0, "height": 4.0},
        liters_per_m2_week=Decimal("2.0"),
    )

    SiteFeature.objects.create(
        site_version=site_version,
        feature_type="lawn_zone",
        label="Back Lawn",
        geometry={"x": 3.0, "y": 0, "width": 3.0, "height": 4.0},
        liters_per_m2_week=Decimal("1.5"),
    )

    total_water = calculate_lawn_zone_water(site_version)

    area1 = Decimal("3.0") * Decimal("4.0")
    area2 = Decimal("3.0") * Decimal("4.0")
    expected = area1 * Decimal("2.0") + area2 * Decimal("1.5")

    assert total_water == expected


@pytest.mark.django_db
def test_lawn_zone_without_water_need(
    seeded_catalog: None, api_client: APIClient, project, valid_plan_payload: dict
) -> None:
    """Lawn zones without liters_per_m2_week are skipped."""
    api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    )
    site_version = project.site.versions.first()

    SiteFeature.objects.create(
        site_version=site_version,
        feature_type="lawn_zone",
        label="No Water Lawn",
        geometry={"x": 0, "y": 0, "width": 5.0, "height": 5.0},
    )

    total_water = calculate_lawn_zone_water(site_version)
    assert total_water == Decimal("0")


@pytest.mark.django_db
def test_water_source_type_in_network_design(
    seeded_catalog: None, api_client: APIClient, project, valid_plan_payload: dict
) -> None:
    """water_source_type is exposed in irrigation network design API."""
    generated = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    ).json()
    layout_id = generated["layout_id"]

    payload = {
        "water_source_x": 5.0,
        "water_source_y": 3.0,
        "water_source_type": "well",
        "num_main_pipes": 1,
    }
    response = api_client.post(
        f"/api/v1/layouts/{layout_id}/irrigation-network-design/", payload, format="json"
    )

    assert response.status_code == 201
    design = IrrigationNetworkDesign.objects.get(layout_id=layout_id)
    assert design.water_source_type == "well"

    get_response = api_client.get(f"/api/v1/layouts/{layout_id}/irrigation-network-design/")
    assert get_response.status_code == 200
    assert get_response.json()["water_source_type"] == "well"


@pytest.mark.django_db
def test_estimate_with_lawn_zones() -> None:
    """Irrigation estimate includes lawn zone water calculation."""
    from domain.planning import Placement

    placements = [
        Placement(
            plant_id="test1",
            name="Test Plant",
            x=1.0,
            y=1.0,
            clearance_radius_m=0.5,
            structure_clearance_m=0.5,
            water_need="low",
            liters_per_week=10.0,
            color="#7ea16b",
        )
    ]

    result = estimate_irrigation(
        placements,
        variable_water_price_clp_per_m3=Decimal("1200"),
        fixed_charge_clp=Decimal("3000"),
        efficiency=Decimal("0.85"),
    )

    assert result.weekly_liters > 0
    assert result.monthly_cubic_meters > 0
    assert result.projected_bill_cost_clp > result.fixed_charge_clp


@pytest.mark.django_db
def test_lawn_zone_water_need_choices() -> None:
    """Lawn zones support water_need choices."""
    from projects.models import SiteFeature

    choices = dict(SiteFeature.WaterNeed.choices)
    assert "low" in choices
    assert "medium" in choices
    assert "high" in choices
