from __future__ import annotations

from django.contrib import admin

from catalog.models import PlantCultivar, PlantRuleVersion, PlantSpecies


@admin.register(PlantSpecies)
class PlantSpeciesAdmin(admin.ModelAdmin):
    list_display = ("scientific_name", "origin_chile", "is_invasive", "is_restricted")
    list_filter = ("origin_chile", "is_invasive", "is_restricted")
    search_fields = ("scientific_name", "slug")


@admin.register(PlantCultivar)
class PlantCultivarAdmin(admin.ModelAdmin):
    list_display = (
        "display_name",
        "species",
        "category",
        "water_need",
        "is_verified",
        "is_active",
    )
    list_filter = ("category", "water_need", "is_verified", "is_active")
    search_fields = ("display_name", "slug", "species__scientific_name")


@admin.register(PlantRuleVersion)
class PlantRuleVersionAdmin(admin.ModelAdmin):
    list_display = ("cultivar", "version", "confidence", "reviewed_at", "valid_from")
    search_fields = ("cultivar__display_name", "source_label")
