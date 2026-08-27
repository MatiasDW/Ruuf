from __future__ import annotations

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from catalog.models import GrassSpecies, PlantCultivar, PlantSpecies


@pytest.mark.django_db
class TestPlantCultivarImages:
    def test_plant_cultivar_image_url_field(self) -> None:
        """PlantCultivar.image_url is optional URLField."""
        species = PlantSpecies.objects.create(
            slug="test-species",
            scientific_name="Test species",
            origin_chile="native",
        )
        cultivar = PlantCultivar.objects.create(
            species=species,
            slug="test-cultivar",
            display_name="Test Plant",
            category="tree",
            canopy_radius_m=Decimal("2.0"),
            recommended_spacing_m=Decimal("2.0"),
            structure_clearance_m=Decimal("1.0"),
            water_need="low",
            liters_per_week_estimate=Decimal("50.0"),
            image_url="https://example.com/plant.jpg",
        )
        assert cultivar.image_url == "https://example.com/plant.jpg"

    def test_plant_cultivar_image_url_blank(self) -> None:
        """PlantCultivar.image_url can be blank."""
        species = PlantSpecies.objects.create(
            slug="test-species-2",
            scientific_name="Test species 2",
            origin_chile="native",
        )
        cultivar = PlantCultivar.objects.create(
            species=species,
            slug="test-cultivar-2",
            display_name="Test Plant 2",
            category="shrub",
            canopy_radius_m=Decimal("1.5"),
            recommended_spacing_m=Decimal("1.5"),
            structure_clearance_m=Decimal("0.8"),
            water_need="medium",
            liters_per_week_estimate=Decimal("30.0"),
            image_url="",
        )
        assert cultivar.image_url == ""

    def test_plant_cultivar_serializer_includes_image_url(self, api_client: APIClient) -> None:
        """PlantCultivarSerializer includes image_url field."""
        species = PlantSpecies.objects.create(
            slug="test-species-3",
            scientific_name="Test species 3",
            origin_chile="native",
        )
        PlantCultivar.objects.create(
            species=species,
            slug="test-cultivar-3",
            display_name="Test Plant 3",
            category="flower",
            canopy_radius_m=Decimal("0.5"),
            recommended_spacing_m=Decimal("0.5"),
            structure_clearance_m=Decimal("0.2"),
            water_need="high",
            liters_per_week_estimate=Decimal("20.0"),
            image_url="https://example.com/flower.jpg",
        )

        response = api_client.get("/api/v1/plant-cultivars/")
        assert response.status_code == 200
        data = response.json()
        results = data["results"]
        assert len(results) > 0
        flower = next(r for r in results if r["slug"] == "test-cultivar-3")
        assert "image_url" in flower
        assert flower["image_url"] == "https://example.com/flower.jpg"

    def test_compat_plant_serializer_includes_emoji(self, seeded_catalog: None) -> None:
        """CompatibilityPlantSerializer includes derived emoji field."""
        from api.serializers import CompatibilityPlantSerializer

        # Simulate the cultivar->dict conversion used by the planner
        cultivar = PlantCultivar.objects.filter(category="tree").first()
        assert cultivar is not None

        data = {
            "id": cultivar.slug,
            "name": cultivar.display_name,
            "category": cultivar.category,
            "clearance_radius_m": float(cultivar.canopy_radius_m),
            "structure_clearance_m": float(cultivar.structure_clearance_m),
            "sunlight": cultivar.sunlight,
            "water_need": cultivar.water_need,
            "liters_per_week": float(cultivar.liters_per_week_estimate),
            "style_tags": cultivar.style_tags,
            "color": cultivar.color,
            "image_url": cultivar.image_url,
        }

        serializer = CompatibilityPlantSerializer(data)
        assert serializer.data["emoji"] == "🌳"

    def test_compat_serializer_emoji_by_category(self) -> None:
        """CompatibilityPlantSerializer emoji mapping is correct."""
        from api.serializers import CompatibilityPlantSerializer

        categories = {
            "tree": "🌳",
            "shrub": "🌿",
            "flower": "🌸",
            "grass": "🌱",
            "groundcover": "🌿",
            "unknown": "🌿",  # default
        }

        for category, expected_emoji in categories.items():
            data = {
                "id": f"test-{category}",
                "name": f"Test {category}",
                "category": category,
                "clearance_radius_m": 1.0,
                "structure_clearance_m": 0.5,
                "sunlight": ["full_sun"],
                "water_need": "medium",
                "liters_per_week": 10.0,
                "style_tags": [],
                "color": "#000000",
                "image_url": "",
            }
            serializer = CompatibilityPlantSerializer(data)
            assert serializer.data["emoji"] == expected_emoji

    def test_compat_plants_endpoint_returns_emoji_and_image_url(
        self, api_client: APIClient, seeded_catalog: None
    ) -> None:
        """The anonymous /api/plants surface (the one the frontend consumes)
        includes emoji and image_url — not just the v1 serializers."""
        client = APIClient()
        response = client.get("/api/plants")
        assert response.status_code == 200
        plants = response.json()
        assert len(plants) > 0
        for plant in plants:
            assert "image_url" in plant
            assert "emoji" in plant
        tree = next(p for p in plants if p["category"] == "tree")
        assert tree["emoji"] == "🌳"


@pytest.mark.django_db
class TestGrassSpeciesImages:
    def test_grass_species_image_url_field(self) -> None:
        """GrassSpecies.image_url is optional URLField."""
        from datetime import date

        grass = GrassSpecies.objects.create(
            slug="test-grass",
            common_name="Test Grass",
            liters_per_m2_week=2.5,
            sunlight="full_sun",
            foot_traffic_resistance="high",
            image_url="https://example.com/grass.jpg",
            source="Test",
            valid_from=date(2024, 1, 1),
        )
        assert grass.image_url == "https://example.com/grass.jpg"

    def test_grass_species_image_url_blank(self) -> None:
        """GrassSpecies.image_url can be blank."""
        from datetime import date

        grass = GrassSpecies.objects.create(
            slug="test-grass-2",
            common_name="Test Grass 2",
            liters_per_m2_week=2.0,
            sunlight="full_sun",
            foot_traffic_resistance="high",
            image_url="",
            source="Test",
            valid_from=date(2024, 1, 1),
        )
        assert grass.image_url == ""

    def test_grass_species_serializer_includes_image_url(self, api_client: APIClient) -> None:
        """GrassSpeciesSerializer includes image_url field."""
        from datetime import date

        GrassSpecies.objects.create(
            slug="test-grass-3",
            common_name="Test Grass 3",
            liters_per_m2_week=Decimal("2.5"),
            sunlight="full_sun",
            foot_traffic_resistance="high",
            image_url="https://example.com/grass-3.jpg",
            source="Test",
            valid_from=date(2024, 1, 1),
        )

        response = api_client.get("/api/grasses/")
        assert response.status_code == 200
        data = response.json()
        results = data["results"]
        assert len(results) > 0
        grass_item = next(r for r in results if r["slug"] == "test-grass-3")
        assert "image_url" in grass_item
        assert grass_item["image_url"] == "https://example.com/grass-3.jpg"
