from __future__ import annotations

from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from common.models import UUIDTimeStampedModel
from planning.models import LayoutVersion


class WaterProvider(UUIDTimeStampedModel):
    name = models.CharField(max_length=180)
    slug = models.SlugField(max_length=180, unique=True)
    country = models.CharField(max_length=2, default="CL")
    service_regions = models.JSONField(default=list)
    website = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class TariffVersion(UUIDTimeStampedModel):
    provider = models.ForeignKey(WaterProvider, on_delete=models.CASCADE, related_name="tariffs")
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    fixed_charge_clp = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    potable_water_clp_per_m3 = models.DecimalField(max_digits=14, decimal_places=4)
    sewer_clp_per_m3 = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    peak_surcharge_clp_per_m3 = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    overconsumption_threshold_m3 = models.DecimalField(
        max_digits=12, decimal_places=3, null=True, blank=True
    )
    source_url = models.URLField()
    source_label = models.CharField(max_length=200)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    is_verified = models.BooleanField(default=False)

    class Meta:
        ordering = ("provider", "-effective_from")
        constraints = [
            models.UniqueConstraint(
                fields=("provider", "effective_from"), name="irrigation_unique_tariff_start"
            )
        ]


class IrrigationZone(UUIDTimeStampedModel):
    layout_version = models.ForeignKey(
        LayoutVersion, on_delete=models.CASCADE, related_name="irrigation_zones"
    )
    name = models.CharField(max_length=120)
    geometry = models.JSONField(default=dict)
    emitter_type = models.CharField(max_length=80, default="drip")
    target_flow_l_min = models.DecimalField(max_digits=10, decimal_places=3)
    efficiency = models.DecimalField(
        max_digits=4,
        decimal_places=3,
        default=0.85,
        validators=[MinValueValidator(Decimal("0.1")), MaxValueValidator(Decimal("1"))],
    )
    schedule = models.JSONField(default=dict, blank=True)


class IrrigationEstimate(UUIDTimeStampedModel):
    layout_version = models.ForeignKey(
        LayoutVersion, on_delete=models.CASCADE, related_name="irrigation_estimates"
    )
    tariff_version = models.ForeignKey(
        TariffVersion,
        on_delete=models.PROTECT,
        related_name="estimates",
        null=True,
        blank=True,
    )
    scenario = models.CharField(max_length=30, default="baseline")
    weekly_liters = models.DecimalField(max_digits=14, decimal_places=3)
    monthly_cubic_meters = models.DecimalField(max_digits=14, decimal_places=3)
    low_monthly_cubic_meters = models.DecimalField(max_digits=14, decimal_places=3)
    high_monthly_cubic_meters = models.DecimalField(max_digits=14, decimal_places=3)
    incremental_cost_clp = models.DecimalField(max_digits=16, decimal_places=2)
    projected_bill_cost_clp = models.DecimalField(max_digits=16, decimal_places=2)
    assumptions = models.JSONField(default=dict)
    confidence = models.CharField(max_length=20, default="prototype")

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("layout_version", "scenario"),
                name="irrigation_unique_estimate_scenario",
            )
        ]
