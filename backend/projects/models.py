from __future__ import annotations

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from common.models import UUIDTimeStampedModel
from identity.models import Client, Organization, User


class Project(UUIDTimeStampedModel):
    class Status(models.TextChoices):
        LEAD = "lead", "Lead"
        DISCOVERY = "discovery", "Discovery"
        DESIGN = "design", "Design"
        REVIEW = "review", "Review"
        APPROVED = "approved", "Approved"
        ARCHIVED = "archived", "Archived"

    class OutputLevel(models.TextChoices):
        CONCEPT = "L0", "Concept"
        PRELIMINARY = "L1", "Preliminary"
        TECHNICAL = "L2", "Technical"

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="projects"
    )
    client = models.ForeignKey(
        Client, on_delete=models.PROTECT, related_name="projects", null=True, blank=True
    )
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="assigned_projects",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DISCOVERY)
    output_level = models.CharField(
        max_length=2, choices=OutputLevel.choices, default=OutputLevel.CONCEPT
    )
    currency = models.CharField(max_length=3, default="CLP")
    budget_min = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    budget_max = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    target_date = models.DateField(null=True, blank=True)
    tags = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ("-updated_at",)
        indexes = [models.Index(fields=("organization", "status", "updated_at"))]

    def __str__(self) -> str:
        return self.name


class Site(UUIDTimeStampedModel):
    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name="site")
    commune = models.CharField(max_length=120, blank=True)
    region = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=2, default="CL")
    address = models.CharField(max_length=250, blank=True)
    location_precision = models.CharField(max_length=20, default="approximate")
    timezone = models.CharField(max_length=64, default="America/Santiago")
    water_provider_name = models.CharField(max_length=160, blank=True)

    def __str__(self) -> str:
        return f"Site for {self.project.name}"


class SiteVersion(UUIDTimeStampedModel):
    class Method(models.TextChoices):
        CLIENT_REPORTED = "reported", "Client reported"
        DRAWN = "drawn", "Drawn in editor"
        CALIBRATED_PLAN = "calibrated", "Calibrated plan"
        PROFESSIONAL_SURVEY = "survey", "Professional survey"

    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="versions")
    revision = models.PositiveIntegerField()
    method = models.CharField(max_length=20, choices=Method.choices, default=Method.CLIENT_REPORTED)
    width_m = models.DecimalField(
        max_digits=10, decimal_places=3, validators=[MinValueValidator(Decimal("0.001"))]
    )
    height_m = models.DecimalField(
        max_digits=10, decimal_places=3, validators=[MinValueValidator(Decimal("0.001"))]
    )
    boundary = models.JSONField(default=dict)
    orientation_deg = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    precision_m = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    sunlight = models.CharField(max_length=20, default="full_sun")
    preferred_style = models.CharField(max_length=30, default="mediterranean")
    author = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="site_versions",
        null=True,
        blank=True,
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("site", "-revision")
        constraints = [
            models.UniqueConstraint(
                fields=("site", "revision"), name="projects_unique_site_revision"
            )
        ]


class SiteFeature(UUIDTimeStampedModel):
    class FeatureType(models.TextChoices):
        HOUSE = "house", "House"
        PAVEMENT = "pavement", "Pavement"
        FENCE = "fence", "Fence"
        UTILITY = "utility", "Utility"
        EXISTING_PLANT = "existing_plant", "Existing plant"
        LAWN_ZONE = "lawn_zone", "Lawn zone"
        OTHER = "other", "Other"

    class WaterNeed(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    site_version = models.ForeignKey(SiteVersion, on_delete=models.CASCADE, related_name="features")
    feature_type = models.CharField(max_length=30, choices=FeatureType.choices)
    label = models.CharField(max_length=120)
    geometry = models.JSONField()
    height_m = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    depth_m = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    plantable = models.BooleanField(default=False)
    removable = models.BooleanField(default=False)
    source = models.CharField(max_length=30, default="client")
    confidence = models.DecimalField(max_digits=4, decimal_places=3, default=0.5)
    metadata = models.JSONField(default=dict, blank=True)
    water_need = models.CharField(
        max_length=10,
        choices=WaterNeed.choices,
        null=True,
        blank=True,
        help_text="Water need for lawn zones",
    )
    liters_per_m2_week = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        null=True,
        blank=True,
        help_text="Weekly water consumption per m² (lawn zones only)",
    )

    class Meta:
        indexes = [models.Index(fields=("site_version", "feature_type"))]
