from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Protocol

WEEKS_PER_MONTH = Decimal("4.345")


class WaterPlacement(Protocol):
    @property
    def liters_per_week(self) -> float: ...


@dataclass(frozen=True)
class IrrigationResult:
    weekly_liters: Decimal
    monthly_cubic_meters: Decimal
    low_monthly_cubic_meters: Decimal
    high_monthly_cubic_meters: Decimal
    incremental_cost_clp: Decimal
    projected_bill_cost_clp: Decimal
    fixed_charge_clp: Decimal
    variable_rate_clp_per_m3: Decimal
    sewer_rate_clp_per_m3: Decimal
    efficiency: Decimal


def money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def volume(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)


def estimate_irrigation(
    placements: Sequence[WaterPlacement],
    *,
    variable_water_price_clp_per_m3: Decimal,
    fixed_charge_clp: Decimal = Decimal(0),
    sewer_price_clp_per_m3: Decimal = Decimal(0),
    efficiency: Decimal = Decimal("0.85"),
) -> IrrigationResult:
    if not Decimal("0.1") <= efficiency <= Decimal(1):
        raise ValueError("Irrigation efficiency must be between 0.1 and 1.0.")

    net_weekly_liters = sum(
        (Decimal(str(item.liters_per_week)) for item in placements), start=Decimal(0)
    )
    gross_weekly_liters = net_weekly_liters / efficiency
    monthly_m3 = gross_weekly_liters * WEEKS_PER_MONTH / Decimal(1000)
    low_m3 = monthly_m3 * Decimal("0.80")
    high_m3 = monthly_m3 * Decimal("1.25")
    variable_rate = variable_water_price_clp_per_m3 + sewer_price_clp_per_m3
    incremental = monthly_m3 * variable_rate
    projected = fixed_charge_clp + incremental

    return IrrigationResult(
        weekly_liters=volume(gross_weekly_liters),
        monthly_cubic_meters=volume(monthly_m3),
        low_monthly_cubic_meters=volume(low_m3),
        high_monthly_cubic_meters=volume(high_m3),
        incremental_cost_clp=money(incremental),
        projected_bill_cost_clp=money(projected),
        fixed_charge_clp=money(fixed_charge_clp),
        variable_rate_clp_per_m3=variable_water_price_clp_per_m3,
        sewer_rate_clp_per_m3=sewer_price_clp_per_m3,
        efficiency=efficiency,
    )
