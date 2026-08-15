from __future__ import annotations

from django.contrib import admin

from irrigation.models import IrrigationEstimate, IrrigationZone, TariffVersion, WaterProvider


@admin.register(WaterProvider)
class WaterProviderAdmin(admin.ModelAdmin):
    list_display = ("name", "country", "is_active")
    search_fields = ("name", "slug")


@admin.register(TariffVersion)
class TariffVersionAdmin(admin.ModelAdmin):
    list_display = (
        "provider",
        "effective_from",
        "effective_to",
        "potable_water_clp_per_m3",
        "is_verified",
    )
    list_filter = ("provider", "is_verified")


@admin.register(IrrigationZone)
class IrrigationZoneAdmin(admin.ModelAdmin):
    list_display = ("name", "layout_version", "emitter_type", "target_flow_l_min")


@admin.register(IrrigationEstimate)
class IrrigationEstimateAdmin(admin.ModelAdmin):
    list_display = (
        "layout_version",
        "scenario",
        "monthly_cubic_meters",
        "incremental_cost_clp",
        "confidence",
    )
