from __future__ import annotations

from decimal import Decimal

import pytest

from planning.services import run_plan


@pytest.mark.django_db
class TestLawnPolygonWater:
    def test_triangle_polygon_water_calculation(self) -> None:
        """Triangle polygon (area 6 m²) x 2.5 L/m² = 15L weekly."""
        # Triangle: (0,0), (3,0), (0,4) → area = 6 m²
        payload = {
            "site": {
                "yard_width": 10.0,
                "yard_height": 10.0,
                "sunlight": "full_sun",
                "style": "mediterranean",
            },
            "requests": [],
            "lawn_zones": [
                {
                    "x": 0,
                    "y": 0,
                    "width": 3,
                    "height": 4,
                    "polygon": [
                        {"x": 0.0, "y": 0.0},
                        {"x": 3.0, "y": 0.0},
                        {"x": 0.0, "y": 4.0},
                    ],
                    "liters_per_m2_week": Decimal("2.5"),
                }
            ],
            "irrigation": {
                "water_price_clp_per_m3": 0,
                "fixed_charge_clp": 0,
                "sewer_price_clp_per_m3": 0,
                "efficiency": "1.0",
            },
        }

        result, irrigation = run_plan(payload)

        # Expected: 6 m² x 2.5 L/m² = 15 L/week
        assert irrigation.weekly_liters == Decimal("15")

    def test_self_intersecting_polygon_fails(self) -> None:
        """Self-intersecting polygon (bowtie) should fail validation."""
        payload = {
            "site": {
                "yard_width": 10.0,
                "yard_height": 10.0,
            },
            "requests": [],
            "lawn_zones": [
                {
                    "x": 0,
                    "y": 0,
                    "width": 4,
                    "height": 4,
                    "polygon": [
                        {"x": 0.0, "y": 0.0},
                        {"x": 4.0, "y": 4.0},
                        {"x": 4.0, "y": 0.0},
                        {"x": 0.0, "y": 4.0},
                    ],
                    "liters_per_m2_week": Decimal("2.5"),
                }
            ],
        }

        from api.serializers import LawnZoneInputSerializer

        serializer = LawnZoneInputSerializer(data=payload["lawn_zones"][0])
        assert not serializer.is_valid()
        assert "polygon" in serializer.errors

    def test_grass_species_slug_resolution(self, seeded_catalog: None) -> None:
        """Lawn zone with grass_species_slug uses species liters_per_m2_week."""
        # Rectangle 2x2 = 4 m² with festuca (2.0 L/m²) = 8 L/week
        payload = {
            "site": {
                "yard_width": 10.0,
                "yard_height": 10.0,
                "sunlight": "full_sun",
                "style": "mediterranean",
            },
            "requests": [],
            "lawn_zones": [
                {
                    "x": 0,
                    "y": 0,
                    "width": 2,
                    "height": 2,
                    "grass_species_slug": "festuca",
                }
            ],
            "irrigation": {
                "water_price_clp_per_m3": 0,
                "fixed_charge_clp": 0,
                "sewer_price_clp_per_m3": 0,
                "efficiency": "1.0",
            },
        }

        result, irrigation = run_plan(payload)

        # Expected: 4 m² x 2.0 L/m² (festuca) = 8 L/week
        assert irrigation.weekly_liters == Decimal("8")

    def test_nonexistent_grass_species_slug_fails(self) -> None:
        """Nonexistent grass_species_slug should fail validation."""
        from api.serializers import LawnZoneInputSerializer

        data = {
            "x": 0,
            "y": 0,
            "width": 2,
            "height": 2,
            "grass_species_slug": "nonexistent-grass",
        }

        serializer = LawnZoneInputSerializer(data=data)
        assert not serializer.is_valid()
        assert "grass_species_slug" in serializer.errors
