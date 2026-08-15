from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from landscape import Placement


@dataclass(frozen=True)
class IrrigationEstimate:
    weekly_liters: float
    monthly_m3: float
    monthly_variable_cost_clp: float
    monthly_total_cost_clp: float


def estimate_irrigation(
    placements: Iterable[Placement],
    variable_water_price_clp_per_m3: float,
    fixed_charge_clp: float,
) -> IrrigationEstimate:
    weekly_liters = sum(item.liters_per_week for item in placements)
    monthly_m3 = (weekly_liters * 4.345) / 1000.0
    monthly_variable_cost_clp = monthly_m3 * variable_water_price_clp_per_m3
    monthly_total_cost_clp = fixed_charge_clp + monthly_variable_cost_clp
    return IrrigationEstimate(
        weekly_liters=weekly_liters,
        monthly_m3=monthly_m3,
        monthly_variable_cost_clp=monthly_variable_cost_clp,
        monthly_total_cost_clp=monthly_total_cost_clp,
    )
