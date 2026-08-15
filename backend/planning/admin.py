from __future__ import annotations

from django.contrib import admin

from planning.models import Layout, LayoutItem, LayoutVersion, SolverRun, ValidationIssue


@admin.register(Layout)
class LayoutAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "objective", "status", "current_revision")
    list_filter = ("status", "objective")


@admin.register(LayoutVersion)
class LayoutVersionAdmin(admin.ModelAdmin):
    list_display = ("layout", "revision", "status", "author_type", "engine_version")
    list_filter = ("status", "author_type", "engine_version")


@admin.register(LayoutItem)
class LayoutItemAdmin(admin.ModelAdmin):
    list_display = ("cultivar", "layout_version", "x_m", "y_m", "source", "is_locked")
    list_filter = ("source", "is_locked")


@admin.register(ValidationIssue)
class ValidationIssueAdmin(admin.ModelAdmin):
    list_display = ("code", "layout_version", "severity", "status")
    list_filter = ("severity", "status", "code")


@admin.register(SolverRun)
class SolverRunAdmin(admin.ModelAdmin):
    list_display = ("layout_version", "algorithm", "status", "progress", "created_at")
    list_filter = ("algorithm", "status")
