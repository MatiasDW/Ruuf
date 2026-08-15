from __future__ import annotations

import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_health_endpoint_is_available() -> None:
    response = APIClient().get("/api/health", HTTP_X_REQUEST_ID="health-test")

    assert response.status_code == 200
    assert response["X-Request-ID"] == "health-test"
    assert response.json()["database"] == "ok"


@pytest.mark.django_db
def test_public_catalog_keeps_frontend_contract(seeded_catalog: None) -> None:
    response = APIClient().get("/api/plants")

    assert response.status_code == 200
    quillay = next(item for item in response.json() if item["id"] == "quillay")
    assert quillay["clearance_radius_m"] == 2.5
    assert quillay["water_need"] == "low"


@pytest.mark.django_db
def test_public_plan_generates_layout_and_irrigation(
    seeded_catalog: None, valid_plan_payload: dict[str, object]
) -> None:
    response = APIClient().post("/api/plan", valid_plan_payload, format="json")

    assert response.status_code == 200
    assert response.json()["summary"]["requested_items"] == 4
    assert response.json()["summary"]["placed_items"] > 0
    assert response.json()["irrigation"]["monthly_total_cost_clp"] > 3000


@pytest.mark.django_db
def test_public_plan_rejects_unknown_and_extra_fields(
    seeded_catalog: None, valid_plan_payload: dict[str, object]
) -> None:
    valid_plan_payload["requests"] = [{"plant_id": "made-up", "quantity": 1}]
    valid_plan_payload["admin"] = True

    response = APIClient().post("/api/plan", valid_plan_payload, format="json")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"
    assert "admin" in response.json()["error"]["details"]
