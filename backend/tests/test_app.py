from __future__ import annotations

from collections.abc import Iterator

import pytest
from flask import Flask

import app as app_module
from cache import NullCache


@pytest.fixture
def application(monkeypatch: pytest.MonkeyPatch) -> Iterator[Flask]:
    monkeypatch.setattr(app_module, "build_cache", NullCache)
    flask_app = app_module.create_app()
    flask_app.config.update(TESTING=True)
    yield flask_app


@pytest.fixture
def client(application: Flask):
    return application.test_client()


def valid_payload() -> dict[str, object]:
    return {
        "site": {
            "yard_width": 18,
            "yard_height": 12,
            "sunlight": "full_sun",
            "style": "native",
        },
        "irrigation": {"water_price_clp_per_m3": 1_200, "fixed_charge_clp": 3_000},
        "requests": [{"plant_id": "quillay", "quantity": 1}],
        "obstacles": [],
    }


def test_health_reports_degraded_dependencies(client, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(app_module, "db_ping", lambda: False)

    response = client.get("/api/health", headers={"X-Request-ID": "test-request"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "test-request"
    assert response.json["status"] == "ok"
    assert response.json["database"] == "fallback"
    assert response.json["redis"] == "disabled"


def test_lists_the_fallback_plant_catalog(client) -> None:
    response = client.get("/api/plants")

    assert response.status_code == 200
    assert any(plant["id"] == "quillay" for plant in response.json)


def test_generates_a_plan_and_irrigation_estimate(client) -> None:
    response = client.post("/api/plan", json=valid_payload())

    assert response.status_code == 200
    assert response.json["summary"]["requested_items"] == 1
    assert response.json["summary"]["placed_items"] == 1
    assert response.json["irrigation"]["monthly_total_cost_clp"] > 3_000


def test_returns_all_request_validation_errors(client) -> None:
    payload = valid_payload()
    payload["site"] = {"yard_width": -1, "yard_height": 0}

    response = client.post("/api/plan", json=payload)

    assert response.status_code == 400
    assert response.json["error"]["code"] == "invalid_request"
    assert len(response.json["error"]["details"]) == 2
    assert response.json["error"]["request_id"] == response.headers["X-Request-ID"]


def test_returns_json_for_unknown_routes(client) -> None:
    response = client.get("/api/missing")

    assert response.status_code == 404
    assert response.json["error"]["code"] == "not_found"
