from __future__ import annotations

from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from common.models import UUIDTimeStampedModel
from identity.models import User


class PlantSpecies(UUIDTimeStampedModel):
    class Origin(models.TextChoices):
        NATIVE = "native", "Native"
        ENDEMIC = "endemic", "Endemic"
        EXOTIC = "exotic", "Exotic"
        UNKNOWN = "unknown", "Unknown"

    slug = models.SlugField(max_length=120, unique=True)
    scientific_name = models.CharField(max_length=180, unique=True)
    family = models.CharField(max_length=120, blank=True)
    genus = models.CharField(max_length=120, blank=True)
    common_names = models.JSONField(default=dict)
    origin_chile = models.CharField(max_length=20, choices=Origin.choices, default=Origin.UNKNOWN)
    conservation_status = models.CharField(max_length=60, blank=True)
    is_invasive = models.BooleanField(default=False)
    is_restricted = models.BooleanField(default=False)
    source_references = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ("scientific_name",)

    def __str__(self) -> str:
        return self.scientific_name


class PlantCultivar(UUIDTimeStampedModel):
    class Category(models.TextChoices):
        TREE = "tree", "Tree"
        SHRUB = "shrub", "Shrub"
        FLOWER = "flower", "Flower"
        GROUNDCOVER = "groundcover", "Groundcover"
        GRASS = "grass", "Grass"

    class WaterNeed(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    class FoliageType(models.TextChoices):
        EVERGREEN = "evergreen", "Evergreen"
        DECIDUOUS = "deciduous", "Deciduous (loses leaves in winter)"
        SEMI_DECIDUOUS = "semi_deciduous", "Semi-deciduous (partial loss)"

    species = models.ForeignKey(PlantSpecies, on_delete=models.PROTECT, related_name="cultivars")
    slug = models.SlugField(max_length=120, unique=True)
    cultivar_name = models.CharField(max_length=160, blank=True)
    display_name = models.CharField(max_length=160)
    category = models.CharField(max_length=20, choices=Category.choices)
    growth_habit = models.CharField(max_length=80, blank=True)
    mature_height_min_m = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    mature_height_max_m = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    canopy_radius_m = models.DecimalField(
        max_digits=7, decimal_places=2, validators=[MinValueValidator(Decimal("0"))]
    )
    recommended_spacing_m = models.DecimalField(
        max_digits=7, decimal_places=2, validators=[MinValueValidator(Decimal("0"))]
    )
    root_caution_radius_m = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
        default=0,
    )
    structure_clearance_m = models.DecimalField(
        max_digits=7, decimal_places=2, validators=[MinValueValidator(Decimal("0"))]
    )
    sunlight = models.JSONField(default=list)
    water_need = models.CharField(max_length=10, choices=WaterNeed.choices)
    liters_per_week_estimate = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0"))]
    )
    style_tags = models.JSONField(default=list)
    color = models.CharField(max_length=7, default="#6f8f61")
    foliage_type = models.CharField(
        max_length=20, choices=FoliageType.choices, default=FoliageType.EVERGREEN
    )
    color_winter = models.CharField(
        max_length=7, blank=True, help_text="Stem/branch color in winter (for deciduous plants)"
    )
    provenance = models.CharField(max_length=40, default="prototype_unverified")
    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("display_name",)
        indexes = [models.Index(fields=("category", "is_active", "display_name"))]

    def __str__(self) -> str:
        return self.display_name


class PlantRuleVersion(UUIDTimeStampedModel):
    cultivar = models.ForeignKey(
        PlantCultivar, on_delete=models.CASCADE, related_name="rule_versions"
    )
    version = models.PositiveIntegerField()
    context = models.JSONField(default=dict)
    rules = models.JSONField(default=list)
    source_url = models.URLField(blank=True)
    source_label = models.CharField(max_length=180, blank=True)
    confidence = models.DecimalField(
        max_digits=4,
        decimal_places=3,
        default=0.5,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("1"))],
    )
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="reviewed_plant_rules",
        null=True,
        blank=True,
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("cultivar", "version"), name="catalog_unique_rule_version"
            )
        ]
        ordering = ("cultivar", "-version")
