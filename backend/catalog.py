from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Plant:
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


DEFAULT_PLANTS = [
    Plant(
        id="quillay",
        name="Quillay",
        category="tree",
        clearance_radius_m=2.5,
        structure_clearance_m=2.0,
        sunlight=("full_sun",),
        water_need="low",
        liters_per_week=60.0,
        style_tags=("native", "mediterranean"),
        color="#7ea16b",
    ),
    Plant(
        id="jacaranda",
        name="Jacaranda",
        category="tree",
        clearance_radius_m=3.0,
        structure_clearance_m=2.5,
        sunlight=("full_sun",),
        water_need="medium",
        liters_per_week=85.0,
        style_tags=("lush", "formal"),
        color="#8b6dbf",
    ),
    Plant(
        id="olive",
        name="Olive Tree",
        category="tree",
        clearance_radius_m=2.2,
        structure_clearance_m=1.8,
        sunlight=("full_sun",),
        water_need="low",
        liters_per_week=55.0,
        style_tags=("mediterranean", "formal"),
        color="#94a86f",
    ),
    Plant(
        id="lavender",
        name="Lavender",
        category="flower",
        clearance_radius_m=0.6,
        structure_clearance_m=0.2,
        sunlight=("full_sun",),
        water_need="low",
        liters_per_week=8.0,
        style_tags=("mediterranean", "formal"),
        color="#b48ad6",
    ),
    Plant(
        id="rosemary",
        name="Rosemary",
        category="shrub",
        clearance_radius_m=0.7,
        structure_clearance_m=0.3,
        sunlight=("full_sun", "partial_shade"),
        water_need="low",
        liters_per_week=9.0,
        style_tags=("mediterranean", "formal"),
        color="#5b8c5a",
    ),
    Plant(
        id="agapanthus",
        name="Agapanthus",
        category="flower",
        clearance_radius_m=0.7,
        structure_clearance_m=0.2,
        sunlight=("full_sun", "partial_shade"),
        water_need="medium",
        liters_per_week=12.0,
        style_tags=("formal", "lush"),
        color="#7ca3d8",
    ),
    Plant(
        id="coiron",
        name="Coiron",
        category="grass",
        clearance_radius_m=0.8,
        structure_clearance_m=0.2,
        sunlight=("full_sun",),
        water_need="low",
        liters_per_week=7.0,
        style_tags=("native", "mediterranean"),
        color="#c2b280",
    ),
    Plant(
        id="hydrangea",
        name="Hydrangea",
        category="flower",
        clearance_radius_m=0.9,
        structure_clearance_m=0.4,
        sunlight=("partial_shade", "shade"),
        water_need="high",
        liters_per_week=18.0,
        style_tags=("lush",),
        color="#7fb5d6",
    ),
]

DEFAULT_PLANT_INDEX = {plant.id: plant for plant in DEFAULT_PLANTS}
