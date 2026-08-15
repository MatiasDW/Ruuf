from __future__ import annotations

import math

import pytest

from catalog import DEFAULT_PLANTS
from landscape import PlantRequest, RectangleObstacle, plan_landscape


def test_places_compatible_plants_inside_the_yard_without_overlap() -> None:
    result = plan_landscape(
        yard_width=12,
        yard_height=8,
        requests=[PlantRequest("lavender", 4)],
        plant_catalog=DEFAULT_PLANTS,
        sunlight="full_sun",
        preferred_style="mediterranean",
    )

    assert len(result.placements) == 4
    assert not result.unplaced
    for placement in result.placements:
        assert placement.clearance_radius_m <= placement.x <= 12 - placement.clearance_radius_m
        assert placement.clearance_radius_m <= placement.y <= 8 - placement.clearance_radius_m

    for index, placement in enumerate(result.placements):
        for other in result.placements[index + 1 :]:
            distance = math.dist((placement.x, placement.y), (other.x, other.y))
            assert distance >= placement.clearance_radius_m + other.clearance_radius_m


def test_respects_structure_clearance_around_obstacles() -> None:
    obstacle = RectangleObstacle(x=2, y=2, width=4, height=3, label="House")
    result = plan_landscape(
        yard_width=12,
        yard_height=10,
        requests=[PlantRequest("rosemary", 3)],
        plant_catalog=DEFAULT_PLANTS,
        sunlight="full_sun",
        preferred_style="mediterranean",
        obstacles=[obstacle],
    )

    assert result.placements
    for placement in result.placements:
        clearance = placement.structure_clearance_m
        inside_exclusion = (
            obstacle.x - clearance <= placement.x <= obstacle.x + obstacle.width + clearance
            and obstacle.y - clearance <= placement.y <= obstacle.y + obstacle.height + clearance
        )
        assert not inside_exclusion


def test_rejects_a_plant_that_does_not_match_sunlight() -> None:
    result = plan_landscape(
        yard_width=10,
        yard_height=10,
        requests=[PlantRequest("hydrangea", 1)],
        plant_catalog=DEFAULT_PLANTS,
        sunlight="full_sun",
        preferred_style="lush",
    )

    assert not result.placements
    assert len(result.unplaced) == 1
    assert "site is full_sun" in result.unplaced[0].reason


def test_reports_when_the_yard_is_too_small() -> None:
    result = plan_landscape(
        yard_width=2,
        yard_height=2,
        requests=[PlantRequest("quillay", 1)],
        plant_catalog=DEFAULT_PLANTS,
        sunlight="full_sun",
        preferred_style="native",
    )

    assert not result.placements
    assert result.unplaced[0].name == "Quillay"


def test_rejects_an_unknown_plant_id() -> None:
    with pytest.raises(ValueError, match="Unknown plant id"):
        plan_landscape(
            yard_width=10,
            yard_height=10,
            requests=[PlantRequest("missing", 1)],
            plant_catalog=DEFAULT_PLANTS,
            sunlight="full_sun",
            preferred_style="native",
        )
