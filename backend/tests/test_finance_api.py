from __future__ import annotations

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from finance.models import Expense, ProjectBudget
from projects.models import Project


@pytest.mark.django_db
def test_budget_expenses_and_summary_use_server_calculated_totals(
    api_client: APIClient, project: Project
) -> None:
    budget_response = api_client.post(
        "/api/v1/budgets/",
        {
            "project": str(project.id),
            "baseline_amount": "1000000",
            "forecast_amount": "900000",
            "contingency_amount": "100000",
        },
        format="json",
    )
    assert budget_response.status_code == 201

    expense_response = api_client.post(
        "/api/v1/expenses/",
        {
            "project": str(project.id),
            "category": "plants",
            "description": "Native plants",
            "net_amount": "100000",
            "tax_amount": "19000",
            "currency": "CLP",
            "expense_date": "2026-08-15",
            "status": "draft",
        },
        format="json",
    )
    assert expense_response.status_code == 201
    assert Decimal(expense_response.json()["total_amount"]) == Decimal("119000.00")

    expense_id = expense_response.json()["id"]
    approved = api_client.post(f"/api/v1/expenses/{expense_id}/approve/", {}, format="json")
    assert approved.status_code == 200
    assert approved.json()["status"] == Expense.Status.APPROVED

    summary = api_client.get(f"/api/v1/projects/{project.id}/finance-summary/")
    assert summary.status_code == 200
    assert Decimal(str(summary.json()["committed_amount"])) == Decimal("119000.0")
    budget = ProjectBudget.objects.get(project=project)
    assert budget.committed_amount == Decimal("119000.00")
