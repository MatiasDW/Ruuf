from __future__ import annotations

import pytest

from irrigation import estimate_irrigation
from landscape import Placement


def placement(liters_per_week: float) -> Placement:
    return Placement(
        plant_id="plant",
        name="Plant",
        x=1,
        y=1,
        clearance_radius_m=0.5,
        structure_clearance_m=0.2,
        water_need="low",
        liters_per_week=liters_per_week,
        color="#000000",
    )


def test_converts_liters_to_monthly_volume_and_cost() -> None:
    estimate = estimate_irrigation(
        placements=[placement(60), placement(40)],
        variable_water_price_clp_per_m3=1_200,
        fixed_charge_clp=3_000,
    )

    assert estimate.weekly_liters == 100
    assert estimate.monthly_m3 == pytest.approx(0.4345)
    assert estimate.monthly_variable_cost_clp == pytest.approx(521.4)
    assert estimate.monthly_total_cost_clp == pytest.approx(3_521.4)


def test_handles_an_empty_plan() -> None:
    estimate = estimate_irrigation([], 1_200, 3_000)

    assert estimate.weekly_liters == 0
    assert estimate.monthly_variable_cost_clp == 0
    assert estimate.monthly_total_cost_clp == 3_000
