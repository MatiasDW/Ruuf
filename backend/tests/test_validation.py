from __future__ import annotations

import pytest

from validation import RequestValidationError, parse_plan_payload


def valid_payload() -> dict[str, object]:
    return {
        "site": {
            "yard_width": 20,
            "yard_height": 12,
            "sunlight": "full_sun",
            "style": "native",
        },
        "requests": [{"plant_id": "quillay", "quantity": 2}],
    }


def test_parses_a_valid_payload_with_defaults() -> None:
    result = parse_plan_payload(valid_payload(), {"quillay"})

    assert result.site.yard_width == 20
    assert result.irrigation.water_price_clp_per_m3 == 0
    assert result.obstacles == []


def test_reports_multiple_invalid_fields_in_one_response() -> None:
    payload = valid_payload()
    payload["site"] = {"yard_width": -2, "yard_height": 0, "sunlight": "indoors"}
    payload["requests"] = [{"plant_id": "quillay", "quantity": 0}]

    with pytest.raises(RequestValidationError) as captured:
        parse_plan_payload(payload, {"quillay"})

    fields = {str(item["field"]) for item in captured.value.errors}
    assert {"site.yard_width", "site.yard_height", "site.sunlight", "requests.0.quantity"} <= fields


def test_reports_every_unknown_plant_id() -> None:
    payload = valid_payload()
    payload["requests"] = [
        {"plant_id": "unknown-b", "quantity": 1},
        {"plant_id": "unknown-a", "quantity": 1},
    ]

    with pytest.raises(RequestValidationError) as captured:
        parse_plan_payload(payload, {"quillay"})

    assert [item["message"] for item in captured.value.errors] == [
        "Unknown plant id: unknown-a",
        "Unknown plant id: unknown-b",
    ]
