from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass

from catalog import Plant


@dataclass(frozen=True)
class PlantRequest:
    plant_id: str
    quantity: int


@dataclass(frozen=True)
class RectangleObstacle:
    x: float
    y: float
    width: float
    height: float
    label: str = "Obstacle"


@dataclass(frozen=True)
class Placement:
    plant_id: str
    name: str
    x: float
    y: float
    clearance_radius_m: float
    structure_clearance_m: float
    water_need: str
    liters_per_week: float
    color: str


@dataclass(frozen=True)
class UnplacedItem:
    name: str
    reason: str
    suggestions: tuple[str, ...]


@dataclass(frozen=True)
class PlanResult:
    placements: tuple[Placement, ...]
    unplaced: tuple[UnplacedItem, ...]
    grid_step_m: float


def _inside_yard(x: float, y: float, radius: float, yard_width: float, yard_height: float) -> bool:
    return radius <= x <= yard_width - radius and radius <= y <= yard_height - radius


def _far_from_obstacles(
    x: float, y: float, plant: Plant, obstacles: list[RectangleObstacle]
) -> bool:
    for obstacle in obstacles:
        left = obstacle.x - plant.structure_clearance_m
        right = obstacle.x + obstacle.width + plant.structure_clearance_m
        top = obstacle.y - plant.structure_clearance_m
        bottom = obstacle.y + obstacle.height + plant.structure_clearance_m
        if left <= x <= right and top <= y <= bottom:
            return False
    return True


def _far_from_other_plants(x: float, y: float, plant: Plant, placements: list[Placement]) -> bool:
    for placed in placements:
        dx = placed.x - x
        dy = placed.y - y
        min_distance = placed.clearance_radius_m + plant.clearance_radius_m
        if (dx * dx + dy * dy) ** 0.5 < min_distance:
            return False
    return True


def _candidate_points(
    yard_width: float, yard_height: float, grid_step_m: float
) -> Iterator[tuple[float, float]]:
    y = grid_step_m / 2.0
    while y < yard_height:
        x = grid_step_m / 2.0
        while x < yard_width:
            yield round(x, 3), round(y, 3)
            x += grid_step_m
        y += grid_step_m


def _plant_score(plant: Plant, sunlight: str, preferred_style: str) -> tuple[int, float]:
    sun_score = 1 if sunlight in plant.sunlight else 0
    style_score = 1 if preferred_style in plant.style_tags else 0
    return (sun_score + style_score, plant.clearance_radius_m)


def _suggest_alternatives(
    plant: Plant,
    plant_catalog: list[Plant],
    sunlight: str,
    preferred_style: str,
) -> tuple[str, ...]:
    suggestions: list[str] = []
    for candidate in plant_catalog:
        if candidate.id == plant.id:
            continue
        if sunlight not in candidate.sunlight:
            continue
        if preferred_style not in candidate.style_tags and preferred_style not in plant.style_tags:
            continue
        if (
            candidate.clearance_radius_m <= plant.clearance_radius_m
            and candidate.liters_per_week <= plant.liters_per_week
        ):
            suggestions.append(candidate.name)
    return tuple(suggestions[:3])


def plan_landscape(
    yard_width: float,
    yard_height: float,
    requests: list[PlantRequest],
    plant_catalog: list[Plant],
    sunlight: str,
    preferred_style: str,
    obstacles: list[RectangleObstacle] | None = None,
) -> PlanResult:
    obstacles = obstacles or []
    placements: list[Placement] = []
    unplaced: list[UnplacedItem] = []
    plant_index = {plant.id: plant for plant in plant_catalog}

    expanded_requests: list[Plant] = []
    for request in requests:
        plant = plant_index.get(request.plant_id)
        if plant is None:
            raise ValueError(f"Unknown plant id: {request.plant_id}")
        expanded_requests.extend([plant] * request.quantity)

    expanded_requests.sort(
        key=lambda plant: _plant_score(plant, sunlight, preferred_style), reverse=True
    )

    min_radius = min((plant.clearance_radius_m for plant in expanded_requests), default=0.5)
    grid_step_m = max(0.4, round(min_radius, 2))

    for plant in expanded_requests:
        if sunlight not in plant.sunlight:
            unplaced.append(
                UnplacedItem(
                    name=plant.name,
                    reason=f"Needs {', '.join(plant.sunlight)} but the site is {sunlight}.",
                    suggestions=_suggest_alternatives(
                        plant, plant_catalog, sunlight, preferred_style
                    ),
                )
            )
            continue

        found = False
        for x, y in _candidate_points(yard_width, yard_height, grid_step_m):
            if not _inside_yard(x, y, plant.clearance_radius_m, yard_width, yard_height):
                continue
            if not _far_from_obstacles(x, y, plant, obstacles):
                continue
            if not _far_from_other_plants(x, y, plant, placements):
                continue

            placements.append(
                Placement(
                    plant_id=plant.id,
                    name=plant.name,
                    x=x,
                    y=y,
                    clearance_radius_m=plant.clearance_radius_m,
                    structure_clearance_m=plant.structure_clearance_m,
                    water_need=plant.water_need,
                    liters_per_week=plant.liters_per_week,
                    color=plant.color,
                )
            )
            found = True
            break

        if not found:
            unplaced.append(
                UnplacedItem(
                    name=plant.name,
                    reason=(
                        "No remaining position satisfies yard bounds, obstacle clearance, "
                        "and plant spacing."
                    ),
                    suggestions=_suggest_alternatives(
                        plant, plant_catalog, sunlight, preferred_style
                    ),
                )
            )

    return PlanResult(
        placements=tuple(placements),
        unplaced=tuple(unplaced),
        grid_step_m=grid_step_m,
    )
