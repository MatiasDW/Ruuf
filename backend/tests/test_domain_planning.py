from __future__ import annotations

import math

import pytest

from domain.planning import (
    Placement,
    PlantRequest,
    PlantSpec,
    RectangleObstacle,
    plan_landscape,
    validate_layout,
)

CATALOG = (
    PlantSpec(
        id="tree",
        name="Tree",
        category="tree",
        clearance_radius_m=2,
        structure_clearance_m=1.5,
        sunlight=("full_sun",),
        water_need="medium",
        liters_per_week=60,
        style_tags=("native",),
        color="#448844",
    ),
    PlantSpec(
        id="flower",
        name="Flower",
        category="flower",
        clearance_radius_m=0.5,
        structure_clearance_m=0.2,
        sunlight=("full_sun", "partial_shade"),
        water_need="low",
        liters_per_week=8,
        style_tags=("native", "formal"),
        color="#cc8844",
    ),
    PlantSpec(
        id="shade",
        name="Shade plant",
        category="shrub",
        clearance_radius_m=0.7,
        structure_clearance_m=0.3,
        sunlight=("shade",),
        water_need="medium",
        liters_per_week=12,
        style_tags=("lush",),
        color="#336633",
    ),
)


def test_places_compatible_plants_without_overlap() -> None:
    result = plan_landscape(
        yard_width=12,
        yard_height=8,
        requests=(PlantRequest("flower", 5),),
        plant_catalog=CATALOG,
        sunlight="full_sun",
        preferred_style="native",
    )

    assert len(result.placements) == 5
    assert not result.unplaced
    for index, item in enumerate(result.placements):
        for other in result.placements[index + 1 :]:
            assert math.dist((item.x, item.y), (other.x, other.y)) >= 1


def test_rejects_incompatible_sunlight_and_suggests_alternative() -> None:
    result = plan_landscape(
        yard_width=8,
        yard_height=8,
        requests=(PlantRequest("shade", 1),),
        plant_catalog=CATALOG,
        sunlight="full_sun",
        preferred_style="native",
    )

    assert not result.placements
    assert result.unplaced[0].plant_id == "shade"
    assert "Flower" in result.unplaced[0].suggestions


def test_reports_ring_geometry_for_drag_overlap() -> None:
    first = Placement("first", "First", 2, 2, 1, 0.2, "low", 5, "#000000")
    second = Placement("second", "Second", 2.5, 2, 1, 0.2, "low", 5, "#000000")

    issues = validate_layout((first, second), yard_width=10, yard_height=10, obstacles=())

    assert issues[0].code == "plant_spacing"
    assert issues[0].required_distance_m == 2
    assert issues[0].conflict_geometry == {
        "type": "ring",
        "center": [2.5, 2],
        "radius_m": 1,
    }


def test_respects_true_distance_to_obstacle() -> None:
    obstacle = RectangleObstacle(3, 3, 2, 2, "House")
    result = plan_landscape(
        yard_width=10,
        yard_height=10,
        requests=(PlantRequest("tree", 1),),
        plant_catalog=CATALOG,
        sunlight="full_sun",
        preferred_style="native",
        obstacles=(obstacle,),
    )

    assert result.placements
    item = result.placements[0]
    closest_x = max(obstacle.x, min(item.x, obstacle.x + obstacle.width))
    closest_y = max(obstacle.y, min(item.y, obstacle.y + obstacle.height))
    assert math.dist((item.x, item.y), (closest_x, closest_y)) >= item.structure_clearance_m


def test_rejects_unknown_plant() -> None:
    with pytest.raises(ValueError, match="Unknown plant id"):
        plan_landscape(
            yard_width=10,
            yard_height=10,
            requests=(PlantRequest("missing", 1),),
            plant_catalog=CATALOG,
            sunlight="full_sun",
            preferred_style="native",
        )
