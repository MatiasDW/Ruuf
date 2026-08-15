from __future__ import annotations

import logging
import os
import re
import time
import uuid
from dataclasses import asdict

from flask import Flask, Response, g, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from cache import build_cache, plan_cache_key
from irrigation import estimate_irrigation
from landscape import PlantRequest, RectangleObstacle, plan_landscape
from observability import configure_logging
from repository import db_ping, list_plants
from settings import cors_origins, stitch_status
from validation import RequestValidationError, parse_plan_payload

configure_logging()
logger = logging.getLogger(__name__)
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": cors_origins()}})
    cache = build_cache()

    @app.before_request
    def start_request() -> None:
        incoming_request_id = request.headers.get("X-Request-ID", "")
        g.request_id = (
            incoming_request_id
            if REQUEST_ID_PATTERN.fullmatch(incoming_request_id)
            else str(uuid.uuid4())
        )
        g.request_started_at = time.monotonic()

    @app.after_request
    def complete_request(response: Response) -> Response:
        request_id = getattr(g, "request_id", str(uuid.uuid4()))
        started_at = getattr(g, "request_started_at", time.monotonic())
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "http_request_completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.path,
                "status_code": response.status_code,
                "duration_ms": round((time.monotonic() - started_at) * 1000, 2),
            },
        )
        return response

    @app.errorhandler(RequestValidationError)
    def handle_validation_error(error: RequestValidationError) -> tuple[Response, int]:
        return (
            jsonify(
                {
                    "error": {
                        "code": "invalid_request",
                        "message": "The request contains invalid fields.",
                        "details": error.errors,
                        "request_id": getattr(g, "request_id", None),
                    }
                }
            ),
            400,
        )

    @app.errorhandler(HTTPException)
    def handle_http_error(error: HTTPException) -> tuple[Response, int]:
        return (
            jsonify(
                {
                    "error": {
                        "code": error.name.lower().replace(" ", "_"),
                        "message": error.description,
                        "request_id": getattr(g, "request_id", None),
                    }
                }
            ),
            error.code or 500,
        )

    @app.errorhandler(Exception)
    def handle_unexpected_error(error: Exception) -> tuple[Response, int]:
        logger.exception(
            "http_request_failed",
            extra={
                "request_id": getattr(g, "request_id", None),
                "method": request.method,
                "path": request.path,
            },
        )
        return (
            jsonify(
                {
                    "error": {
                        "code": "internal_error",
                        "message": "An unexpected error occurred.",
                        "request_id": getattr(g, "request_id", None),
                    }
                }
            ),
            500,
        )

    @app.get("/api/health")
    def health() -> Response:
        return jsonify(
            {
                "status": "ok",
                "database": "ok" if db_ping() else "fallback",
                "redis": "ok" if cache.ping() else "disabled",
                "stitch": stitch_status(),
            }
        )

    @app.get("/api/plants")
    def plants() -> Response:
        plant_catalog = list_plants()
        return jsonify(
            [
                {
                    "id": plant.id,
                    "name": plant.name,
                    "category": plant.category,
                    "clearance_radius_m": plant.clearance_radius_m,
                    "structure_clearance_m": plant.structure_clearance_m,
                    "sunlight": list(plant.sunlight),
                    "water_need": plant.water_need,
                    "liters_per_week": plant.liters_per_week,
                    "style_tags": list(plant.style_tags),
                    "color": plant.color,
                }
                for plant in plant_catalog
            ]
        )

    @app.post("/api/plan")
    def plan() -> Response:
        plant_catalog = list_plants()
        payload = parse_plan_payload(
            request.get_json(silent=True),
            valid_plant_ids={plant.id for plant in plant_catalog},
        )
        normalized_payload = payload.model_dump(mode="json")
        cached = cache.get_json(plan_cache_key(normalized_payload))
        if cached is not None:
            return jsonify(cached)

        requests_data = [
            PlantRequest(plant_id=item.plant_id, quantity=item.quantity)
            for item in payload.requests
        ]

        obstacles = [
            RectangleObstacle(
                x=item.x,
                y=item.y,
                width=item.width,
                height=item.height,
                label=item.label,
            )
            for item in payload.obstacles
        ]

        result = plan_landscape(
            yard_width=payload.site.yard_width,
            yard_height=payload.site.yard_height,
            requests=requests_data,
            plant_catalog=plant_catalog,
            sunlight=payload.site.sunlight,
            preferred_style=payload.site.style,
            obstacles=obstacles,
        )
        irrigation_estimate = estimate_irrigation(
            placements=result.placements,
            variable_water_price_clp_per_m3=payload.irrigation.water_price_clp_per_m3,
            fixed_charge_clp=payload.irrigation.fixed_charge_clp,
        )

        response = {
            "summary": {
                "requested_items": sum(item.quantity for item in requests_data),
                "placed_items": len(result.placements),
                "unplaced_items": len(result.unplaced),
                "grid_step_m": result.grid_step_m,
                "fits": len(result.unplaced) == 0,
            },
            "placements": [asdict(item) for item in result.placements],
            "unplaced": [asdict(item) for item in result.unplaced],
            "irrigation": asdict(irrigation_estimate),
        }
        cache.set_json(plan_cache_key(normalized_payload), response, ttl_seconds=300)
        return jsonify(response)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=os.getenv("FLASK_DEBUG") == "1")
