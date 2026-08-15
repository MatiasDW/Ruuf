from __future__ import annotations

from django.contrib import admin

from finance.models import (
    Expense,
    PriceBook,
    PriceItem,
    ProjectBudget,
    QuoteItem,
    QuoteVersion,
)

admin.site.register(PriceBook)
admin.site.register(PriceItem)
admin.site.register(QuoteVersion)
admin.site.register(QuoteItem)


@admin.register(ProjectBudget)
class ProjectBudgetAdmin(admin.ModelAdmin):
    list_display = (
        "project",
        "baseline_amount",
        "forecast_amount",
        "committed_amount",
        "actual_amount",
    )


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("project", "description", "total_amount", "currency", "status", "expense_date")
    list_filter = ("status", "currency", "category")
    search_fields = ("description", "supplier", "project__name")
