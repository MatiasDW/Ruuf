from __future__ import annotations

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from identity.models import Client, Membership, Organization, User


@admin.register(User)
class RuufUserAdmin(UserAdmin):
    ordering = ("email",)
    list_display = ("email", "display_name", "is_staff", "is_active")
    search_fields = ("email", "display_name")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("display_name", "locale", "units")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups")}),
        ("Dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "display_name", "password1", "password2"),
            },
        ),
    )


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "currency", "timezone", "is_active")
    search_fields = ("name", "slug")


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "organization", "role", "status")
    list_filter = ("role", "status")


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("display_name", "organization", "email", "is_active")
    list_filter = ("organization", "is_active")
    search_fields = ("display_name", "email")
