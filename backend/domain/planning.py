from __future__ import annotations

import math
from collections.abc import Iterable, Iterator, Sequence
from dataclasses import dataclass

ENGINE_VERSION = "grid-v2"


@dataclass(frozen=True)
class PlantSpec:
    id: str
    name: str
    category: str
    clearance_radius_m: float
    structure_clearance_m: float
    sunlight: tuple[str, ...]
    water_need: str
    liters_per_week: float
    style_tags: tuple[str, ...]
    color: str


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
class ConstraintIssue:
    code: str
    severity: str
    message: str
    plant_id: str
    related_plant_id: str | None = None
    required_distance_m: float | None = None
    actual_distance_m: float | None = None
    conflict_geometry: dict[str, object] | None = None


@dataclass(frozen=True)
class UnplacedItem:
    plant_id: str
    name: str
    reason: str
    suggestions: tuple[str, ...]


@dataclass(frozen=True)
class PlanResult:
    placements: tuple[Placement, ...]
    unplaced: tuple[UnplacedItem, ...]
    issues: tuple[ConstraintIssue, ...]
    grid_step_m: float
    engine_version: str = ENGINE_VERSION


def _distance(x1: float, y1: float, x2: float, y2: float) -> float:
    return math.hypot(x1 - x2, y1 - y2)


def _inside_yard(x: float, y: float, radius: float, yard_width: float, yard_height: float) -> bool:
    return radius <= x <= yard_width - radius and radius <= y <= yard_height - radius


def _distance_to_rectangle(x: float, y: float, obstacle: RectangleObstacle) -> float:
    closest_x = max(obstacle.x, min(x, obstacle.x + obstacle.width))
    closest_y = max(obstacle.y, min(y, obstacle.y + obstacle.height))
    return _distance(x, y, closest_x, closest_y)


def validate_placement(
    placement: Placement,
    *,
    yard_width: float,
    yard_height: float,
    obstacles: Sequence[RectangleObstacle],
    other_placements: Sequence[Placement],
) -> tuple[ConstraintIssue, ...]:
    issues: list[ConstraintIssue] = []
    if not _inside_yard(
        placement.x,
        placement.y,
        placement.clearance_radius_m,
        yard_width,
        yard_height,
    ):
        issues.append(
            ConstraintIssue(
                code="outside_site_boundary",
                severity="blocking",
                message=f"{placement.name} exceeds the plantable site boundary.",
                plant_id=placement.plant_id,
                conflict_geometry={
                    "type": "circle",
                    "center": [placement.x, placement.y],
                    "radius_m": placement.clearance_radius_m,
                },
            )
        )

    for obstacle in obstacles:
        actual = _distance_to_rectangle(placement.x, placement.y, obstacle)
        required = placement.structure_clearance_m
        if actual < required:
            issues.append(
                ConstraintIssue(
                    code="structure_clearance",
                    severity="blocking",
                    message=(
                        f"{placement.name} needs {required:.2f} m from {obstacle.label}; "
                        f"the current distance is {actual:.2f} m."
                    ),
                    plant_id=placement.plant_id,
                    required_distance_m=required,
                    actual_distance_m=round(actual, 3),
                    conflict_geometry={
                        "type": "circle",
                        "center": [placement.x, placement.y],
                        "radius_m": required,
                    },
                )
            )

    for other in other_placements:
        required = placement.clearance_radius_m + other.clearance_radius_m
        actual = _distance(placement.x, placement.y, other.x, other.y)
        if actual < required:
            issues.append(
                ConstraintIssue(
                    code="plant_spacing",
                    severity="blocking",
                    message=(
                        f"{placement.name} and {other.name} need {required:.2f} m between "
                        f"centers; the current distance is {actual:.2f} m."
                    ),
                    plant_id=placement.plant_id,
                    related_plant_id=other.plant_id,
                    required_distance_m=round(required, 3),
                    actual_distance_m=round(actual, 3),
                    conflict_geometry={
                        "type": "ring",
                        "center": [placement.x, placement.y],
                        "radius_m": placement.clearance_radius_m,
                    },
                )
            )
    return tuple(issues)


def validate_layout(
    placements: Sequence[Placement],
    *,
    yard_width: float,
    yard_height: float,
    obstacles: Sequence[RectangleObstacle],
) -> tuple[ConstraintIssue, ...]:
    issues: list[ConstraintIssue] = []
    for index, placement in enumerate(placements):
        issues.extend(
            validate_placement(
                placement,
                yard_width=yard_width,
                yard_height=yard_height,
                obstacles=obstacles,
                other_placements=placements[:index],
            )
        )
    return tuple(issues)


def _candidate_points(
    yard_width: float, yard_height: float, grid_step_m: float
) -> Iterator[tuple[float, float]]:
    y = grid_step_m / 2
    while y < yard_height:
        x = grid_step_m / 2
        while x < yard_width:
            yield round(x, 3), round(y, 3)
            x += grid_step_m
        y += grid_step_m


def _suggest_alternatives(
    plant: PlantSpec,
    catalog: Sequence[PlantSpec],
    sunlight: str,
    preferred_style: str,
) -> tuple[str, ...]:
    ranked: list[tuple[int, float, str]] = []
    for candidate in catalog:
        if candidate.id == plant.id or sunlight not in candidate.sunlight:
            continue
        if candidate.clearance_radius_m > plant.clearance_radius_m:
            continue
        score = int(preferred_style in candidate.style_tags)
        score += int(candidate.liters_per_week <= plant.liters_per_week)
        ranked.append((score, -candidate.clearance_radius_m, candidate.name))
    ranked.sort(reverse=True)
    return tuple(name for _, _, name in ranked[:3])


def plan_landscape(
    *,
    yard_width: float,
    yard_height: float,
    requests: Iterable[PlantRequest],
    plant_catalog: Sequence[PlantSpec],
    sunlight: str,
    preferred_style: str,
    obstacles: Sequence[RectangleObstacle] = (),
) -> PlanResult:
    placements: list[Placement] = []
    unplaced: list[UnplacedItem] = []
    plant_index = {plant.id: plant for plant in plant_catalog}
    expanded: list[PlantSpec] = []

    for request in requests:
        plant = plant_index.get(request.plant_id)
        if plant is None:
            raise ValueError(f"Unknown plant id: {request.plant_id}")
        expanded.extend([plant] * request.quantity)

    expanded.sort(
        key=lambda plant: (
            sunlight in plant.sunlight,
            preferred_style in plant.style_tags,
            plant.clearance_radius_m,
        ),
        reverse=True,
    )
    minimum_radius = min((plant.clearance_radius_m for plant in expanded), default=0.5)
    grid_step_m = max(0.4, min(2.0, round(minimum_radius, 2)))

    for plant in expanded:
        alternatives = _suggest_alternatives(plant, plant_catalog, sunlight, preferred_style)
        if sunlight not in plant.sunlight:
            unplaced.append(
                UnplacedItem(
                    plant_id=plant.id,
                    name=plant.name,
                    reason=f"The site sunlight ({sunlight}) is incompatible with this plant.",
                    suggestions=alternatives,
                )
            )
            continue

        placed = False
        for x, y in _candidate_points(yard_width, yard_height, grid_step_m):
            candidate = Placement(
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
            if validate_placement(
                candidate,
                yard_width=yard_width,
                yard_height=yard_height,
                obstacles=obstacles,
                other_placements=placements,
            ):
                continue
            placements.append(candidate)
            placed = True
            break

        if not placed:
            unplaced.append(
                UnplacedItem(
                    plant_id=plant.id,
                    name=plant.name,
                    reason=(
                        "No position satisfies site bounds, structure clearance, and plant spacing."
                    ),
                    suggestions=alternatives,
                )
            )

    issues = validate_layout(
        placements,
        yard_width=yard_width,
        yard_height=yard_height,
        obstacles=obstacles,
    )
    return PlanResult(
        placements=tuple(placements),
        unplaced=tuple(unplaced),
        issues=issues,
        grid_step_m=grid_step_m,
    )
