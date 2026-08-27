from __future__ import annotations

from decimal import Decimal

import pytest

from domain.planning import Placement, PolygonObstacle, validate_placement
from planning.services import _obstacles_for_version
from projects.models import Site, SiteFeature, SiteVersion


@pytest.mark.django_db
class TestPolygonObstacles:
    def test_plant_inside_l_shaped_polygon(self) -> None:
        """Plant inside L-shaped polygon violates structure_clearance."""
        # L-shaped polygon: (0,0), (2,0), (2,1), (1,1), (1,2), (0,2)
        polygon = PolygonObstacle(
            points=((0.0, 0.0), (2.0, 0.0), (2.0, 1.0), (1.0, 1.0), (1.0, 2.0), (0.0, 2.0)),
            label="L-shaped building",
            feature_type="quincho",  # 1.0m clearance
        )

        placement = Placement(
            plant_id="test-plant",
            name="Test Plant",
            x=0.5,
            y=0.5,  # Inside the polygon
            clearance_radius_m=0.3,
            structure_clearance_m=0.5,
            water_need="medium",
            liters_per_week=10.0,
            color="#ff0000",
        )

        issues = validate_placement(
            placement,
            yard_width=10.0,
            yard_height=10.0,
            obstacles=[polygon],
            other_placements=(),
        )

        assert len(issues) == 1
        assert issues[0].code == "structure_clearance"
        assert issues[0].plant_id == "test-plant"

    def test_plant_distance_from_polygonal_pool(self) -> None:
        """Plant too close to pool polygon fails clearance, far enough passes."""
        # Square pool: (1,1), (3,1), (3,3), (1,3)
        pool = PolygonObstacle(
            points=((1.0, 1.0), (3.0, 1.0), (3.0, 3.0), (1.0, 3.0)),
            label="Pool",
            feature_type="pool",  # 1.5m clearance
        )

        # Close: distance 0.7m, requires 1.5m pool + 0.1m structure = 1.6m → fails
        placement_close = Placement(
            plant_id="plant-close",
            name="Plant too close",
            x=0.3,
            y=2.0,
            clearance_radius_m=0.2,
            structure_clearance_m=0.1,
            water_need="medium",
            liters_per_week=8.0,
            color="#00ff00",
        )

        issues_close = validate_placement(
            placement_close,
            yard_width=10.0,
            yard_height=10.0,
            obstacles=[pool],
            other_placements=(),
        )
        # Should fail: 0.7m < 1.6m required
        assert len(issues_close) == 1
        assert issues_close[0].code == "structure_clearance"

        # Far: plant at (5,5), distance ≈ 2.8m to nearest pool corner → passes
        placement_far = Placement(
            plant_id="plant-far",
            name="Plant far enough",
            x=5.0,
            y=5.0,
            clearance_radius_m=0.2,
            structure_clearance_m=0.1,
            water_need="medium",
            liters_per_week=8.0,
            color="#00ff00",
        )

        issues_far = validate_placement(
            placement_far,
            yard_width=10.0,
            yard_height=10.0,
            obstacles=[pool],
            other_placements=(),
        )
        # Should pass: 2.8m >= 1.6m required
        assert len(issues_far) == 0

    def test_obstacles_for_version_with_polygon_feature(self, organization) -> None:
        """_obstacles_for_version extracts PolygonObstacle from polygon geometry."""
        project = organization.projects.create(name="Test Project")
        site = Site.objects.create(project=project)
        site_version = SiteVersion.objects.create(
            site=site, revision=1, width_m=Decimal("10.0"), height_m=Decimal("10.0")
        )

        # Formato canónico de validate_geometry (BE-106): puntos como dicts {x, y}.
        SiteFeature.objects.create(
            site_version=site_version,
            feature_type=SiteFeature.FeatureType.POOL,
            label="Pool",
            plantable=False,
            geometry={
                "type": "polygon",
                "points": [
                    {"x": 1.0, "y": 1.0},
                    {"x": 3.0, "y": 1.0},
                    {"x": 3.0, "y": 3.0},
                    {"x": 1.0, "y": 3.0},
                ],
            },
        )

        obstacles = _obstacles_for_version(site_version)

        assert len(obstacles) == 1
        assert isinstance(obstacles[0], PolygonObstacle)
        assert obstacles[0].label == "Pool"
        assert obstacles[0].feature_type == SiteFeature.FeatureType.POOL
        assert obstacles[0].points == ((1.0, 1.0), (3.0, 1.0), (3.0, 3.0), (1.0, 3.0))
