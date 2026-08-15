from __future__ import annotations

from decimal import Decimal

import pytest

from domain.irrigation import estimate_irrigation
from domain.planning import Placement


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
        (placement(60), placement(40)),
        variable_water_price_clp_per_m3=Decimal("1200"),
        fixed_charge_clp=Decimal("3000"),
        sewer_price_clp_per_m3=Decimal("300"),
        efficiency=Decimal("1"),
    )

    assert estimate.weekly_liters == Decimal("100.000")
    assert estimate.monthly_cubic_meters == Decimal("0.435")
    assert estimate.incremental_cost_clp == Decimal("652")
    assert estimate.projected_bill_cost_clp == Decimal("3652")


def test_efficiency_increases_required_water() -> None:
    estimate = estimate_irrigation(
        (placement(85),),
        variable_water_price_clp_per_m3=Decimal("0"),
        efficiency=Decimal("0.85"),
    )

    assert estimate.weekly_liters == Decimal("100.000")


@pytest.mark.parametrize("efficiency", (Decimal("0"), Decimal("1.1")))
def test_rejects_invalid_efficiency(efficiency: Decimal) -> None:
    with pytest.raises(ValueError, match="efficiency"):
        estimate_irrigation((), variable_water_price_clp_per_m3=Decimal("0"), efficiency=efficiency)
