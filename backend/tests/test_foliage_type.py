from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from catalog.models import PlantCultivar


@pytest.mark.django_db
def test_plant_cultivar_has_foliage_type_and_color_winter(seeded_catalog: None) -> None:
    """New foliage attributes track whether plants lose leaves in winter."""
    plant = PlantCultivar.objects.first()
    assert plant is not None
    assert hasattr(plant, "foliage_type")
    assert hasattr(plant, "color_winter")
    assert plant.foliage_type in ["evergreen", "deciduous", "semi_deciduous"]


@pytest.mark.django_db
def test_foliage_type_serialized_in_plant_api(seeded_catalog: None) -> None:
    """API exposes foliage_type and color_winter to frontend."""
    client = APIClient()
    response = client.get("/api/v1/plant-cultivars/")
    assert response.status_code == 200

    plants = response.json()["results"]
    assert len(plants) > 0

    quillay = next((p for p in plants if p["slug"] == "quillay"), None)
    assert quillay is not None
    assert quillay["foliage_type"] == "deciduous"
    assert quillay["color_winter"] == "#8b7355"

    olive = next((p for p in plants if p["slug"] == "olive"), None)
    assert olive is not None
    assert olive["foliage_type"] == "evergreen"
    assert olive["color_winter"] == "#94a86f"


@pytest.mark.django_db
def test_foliage_type_defaults_to_evergreen(seeded_catalog: None) -> None:
    """New plants default to evergreen if not specified."""
    from catalog.models import PlantSpecies

    new_species = PlantSpecies.objects.create(
        slug="test-species",
        scientific_name="Test testis",
        origin_chile="exotic",
    )
    plant = PlantCultivar.objects.create(
        species=new_species,
        slug="test-plant",
        display_name="Test Plant",
        category="shrub",
        canopy_radius_m=1.0,
        recommended_spacing_m=1.0,
        structure_clearance_m=0.5,
        water_need="low",
        liters_per_week_estimate=5.0,
    )

    assert plant.foliage_type == "evergreen"
    assert plant.color_winter == ""


@pytest.mark.django_db
def test_deciduous_plant_has_winter_color() -> None:
    """Deciduous plants should have a color_winter specified."""
    from catalog.models import PlantSpecies

    species = PlantSpecies.objects.create(
        slug="deciduous-test",
        scientific_name="Deciduous testis",
        origin_chile="native",
    )
    plant = PlantCultivar.objects.create(
        species=species,
        slug="test-deciduous",
        display_name="Test Deciduous",
        category="tree",
        canopy_radius_m=2.0,
        recommended_spacing_m=2.0,
        structure_clearance_m=1.0,
        water_need="medium",
        liters_per_week_estimate=50.0,
        foliage_type="deciduous",
        color_winter="#7b6b5b",
    )

    assert plant.foliage_type == "deciduous"
    assert plant.color_winter == "#7b6b5b"
