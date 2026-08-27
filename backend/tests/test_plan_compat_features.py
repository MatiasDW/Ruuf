from __future__ import annotations

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from domain.irrigation import volume
from planning.services import run_plan, serialize_plan


@pytest.mark.django_db
def test_plan_with_pool_clearance(seeded_catalog: None) -> None:
    """Plan with large pool reduces available placement space."""
    payload = {
        "site": {
            "yard_width": 10.0,
            "yard_height": 10.0,
            "sunlight": "full_sun",
            "style": "mediterranean",
        },
        "irrigation": {
            "water_price_clp_per_m3": 1200,
            "sewer_price_clp_per_m3": 350,
            "fixed_charge_clp": 3000,
            "efficiency": 0.85,
        },
        "requests": [
            {"plant_id": "quillay", "quantity": 10},
        ],
        "obstacles": [
            {
                "x": 1.0,
                "y": 1.0,
                "width": 8.0,
                "height": 8.0,
                "label": "Pool",
                "feature_type": "pool",
            }
        ],
    }

    plan_result, irrigation = run_plan(payload)

    assert len(plan_result.unplaced) > 0


@pytest.mark.django_db
def test_plan_with_pool_far_away_succeeds(seeded_catalog: None) -> None:
    """Plan with pool far away doesn't prevent placements."""
    payload = {
        "site": {
            "yard_width": 20.0,
            "yard_height": 20.0,
            "sunlight": "full_sun",
            "style": "mediterranean",
        },
        "irrigation": {
            "water_price_clp_per_m3": 1200,
            "sewer_price_clp_per_m3": 350,
            "fixed_charge_clp": 3000,
            "efficiency": 0.85,
        },
        "requests": [{"plant_id": "quillay", "quantity": 2}],
        "obstacles": [
            {
                "x": 0.0,
                "y": 0.0,
                "width": 2.0,
                "height": 2.0,
                "label": "Pool",
                "feature_type": "pool",
            }
        ],
    }

    plan_result, irrigation = run_plan(payload)
    serialized = serialize_plan(plan_result, irrigation)

    assert serialized["summary"]["fits"] is True
    assert len(plan_result.placements) > 0


@pytest.mark.django_db
def test_plan_with_lawn_zones_water(seeded_catalog: None) -> None:
    """Plan with lawn zones adds water consumption."""
    payload_with_lawn = {
        "site": {
            "yard_width": 20.0,
            "yard_height": 20.0,
            "sunlight": "full_sun",
            "style": "mediterranean",
        },
        "irrigation": {
            "water_price_clp_per_m3": 1200,
            "sewer_price_clp_per_m3": 350,
            "fixed_charge_clp": 3000,
            "efficiency": 0.85,
        },
        "requests": [{"plant_id": "quillay", "quantity": 1}],
        "lawn_zones": [
            {"x": 0.0, "y": 0.0, "width": 20.0, "height": 1.0, "liters_per_m2_week": 2.5}
        ],
    }

    result, irrigation = run_plan(payload_with_lawn)
    lawn_water = irrigation.weekly_liters

    payload_no_lawn = {
        "site": {
            "yard_width": 20.0,
            "yard_height": 20.0,
            "sunlight": "full_sun",
            "style": "mediterranean",
        },
        "irrigation": {
            "water_price_clp_per_m3": 1200,
            "sewer_price_clp_per_m3": 350,
            "fixed_charge_clp": 3000,
            "efficiency": 0.85,
        },
        "requests": [{"plant_id": "quillay", "quantity": 1}],
    }

    result, irrigation = run_plan(payload_no_lawn)
    no_lawn_water = irrigation.weekly_liters

    expected_lawn_water_net = Decimal(20) * Decimal(1) * Decimal("2.5")
    efficiency = Decimal("0.85")
    expected_lawn_water_gross = volume(expected_lawn_water_net / efficiency)
    assert lawn_water == volume(no_lawn_water + expected_lawn_water_gross)


@pytest.mark.django_db
def test_plan_api_invalid_feature_type(api_client: APIClient) -> None:
    """API rejects invalid feature_type."""
    payload = {
        "site": {
            "yard_width": 10.0,
            "yard_height": 10.0,
            "sunlight": "full_sun",
            "style": "mediterranean",
        },
        "requests": [{"plant_id": "quillay", "quantity": 1}],
        "obstacles": [
            {
                "x": 2.0,
                "y": 2.0,
                "width": 2.0,
                "height": 2.0,
                "label": "Unknown",
                "feature_type": "invalid_type",
            }
        ],
    }

    response = api_client.post("/api/plan", payload, format="json")

    assert response.status_code == 400
    assert "feature_type" in str(response.data).lower()
