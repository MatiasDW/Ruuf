from __future__ import annotations

from django.contrib import admin

from projects.models import Project, Site, SiteFeature, SiteVersion


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "client", "status", "output_level", "updated_at")
    list_filter = ("organization", "status", "output_level")
    search_fields = ("name", "client__display_name")


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ("project", "commune", "region", "country", "location_precision")
    search_fields = ("project__name", "commune", "region")


@admin.register(SiteVersion)
class SiteVersionAdmin(admin.ModelAdmin):
    list_display = ("site", "revision", "method", "width_m", "height_m", "approved_at")
    list_filter = ("method", "approved_at")


@admin.register(SiteFeature)
class SiteFeatureAdmin(admin.ModelAdmin):
    list_display = ("label", "site_version", "feature_type", "plantable", "removable")
    list_filter = ("feature_type", "plantable", "removable")
