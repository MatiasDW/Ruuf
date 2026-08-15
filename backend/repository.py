from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Row
from sqlalchemy.exc import SQLAlchemyError

from catalog import DEFAULT_PLANTS, Plant
from db import db_connection

logger = logging.getLogger(__name__)


def _row_to_plant(row: Row[Any]) -> Plant:
    return Plant(
        id=row.id,
        name=row.name,
        category=row.category,
        clearance_radius_m=float(row.clearance_radius_m),
        structure_clearance_m=float(row.structure_clearance_m),
        sunlight=tuple(row.sunlight),
        water_need=row.water_need,
        liters_per_week=float(row.liters_per_week),
        style_tags=tuple(row.style_tags),
        color=row.color,
    )


def list_plants() -> list[Plant]:
    query = text(
        """
        SELECT
            id,
            name,
            category,
            clearance_radius_m,
            structure_clearance_m,
            sunlight,
            water_need,
            liters_per_week,
            style_tags,
            color
        FROM plants
        WHERE is_active = TRUE
        ORDER BY name
        """
    )

    with db_connection() as connection:
        if connection is None:
            return list(DEFAULT_PLANTS)

        try:
            rows = connection.execute(query).fetchall()
        except SQLAlchemyError as error:
            logger.warning(
                "plant_catalog_query_failed",
                extra={"error_type": type(error).__name__},
            )
            return list(DEFAULT_PLANTS)

        if not rows:
            return list(DEFAULT_PLANTS)
        return [_row_to_plant(row) for row in rows]


def get_plant_index() -> dict[str, Plant]:
    return {plant.id: plant for plant in list_plants()}


def db_ping() -> bool:
    query = text("SELECT 1")

    with db_connection() as connection:
        if connection is None:
            return False

        try:
            connection.execute(query).scalar_one()
            return True
        except SQLAlchemyError as error:
            logger.warning("database_ping_failed", extra={"error_type": type(error).__name__})
            return False
