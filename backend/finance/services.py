from __future__ import annotations

from decimal import Decimal
from typing import TypedDict

from django.db.models import Q, Sum
from django.db.models.functions import Coalesce

from finance.models import Expense, ProjectBudget
from projects.models import Project


class FinanceSummary(TypedDict):
    currency: str
    baseline_amount: Decimal
    forecast_amount: Decimal
    contingency_amount: Decimal
    committed_amount: Decimal
    actual_amount: Decimal
    remaining_forecast_amount: Decimal
    variance_to_baseline: Decimal


def project_finance_summary(project: Project) -> FinanceSummary:
    budget, _ = ProjectBudget.objects.get_or_create(project=project)
    aggregates = project.expenses.aggregate(
        committed=Coalesce(
            Sum("total_amount", filter=Q(status=Expense.Status.APPROVED)), Decimal(0)
        ),
        actual=Coalesce(Sum("total_amount", filter=Q(status=Expense.Status.PAID)), Decimal(0)),
    )
    committed = Decimal(aggregates["committed"] or 0) + Decimal(aggregates["actual"] or 0)
    actual = Decimal(aggregates["actual"] or 0)
    if budget.committed_amount != committed or budget.actual_amount != actual:
        budget.committed_amount = committed
        budget.actual_amount = actual
        budget.save(update_fields=("committed_amount", "actual_amount", "updated_at"))

    available = budget.forecast_amount + budget.contingency_amount - committed
    return {
        "currency": project.currency,
        "baseline_amount": budget.baseline_amount,
        "forecast_amount": budget.forecast_amount,
        "contingency_amount": budget.contingency_amount,
        "committed_amount": committed,
        "actual_amount": actual,
        "remaining_forecast_amount": available,
        "variance_to_baseline": budget.forecast_amount - budget.baseline_amount,
    }
