from __future__ import annotations

import uuid

from django.db import models

from catalog.models import PlantCultivar
from common.models import UUIDTimeStampedModel
from identity.models import User
from projects.models import Project, SiteVersion


class Layout(UUIDTimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        REVIEW = "review", "Review"
        APPROVED = "approved", "Approved"
        ARCHIVED = "archived", "Archived"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="layouts")
    name = models.CharField(max_length=180)
    objective = models.CharField(max_length=120, default="balanced")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    current_revision = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("project", "-updated_at")
        indexes = [models.Index(fields=("project", "status", "updated_at"))]

    def __str__(self) -> str:
        return f"{self.project.name}: {self.name}"


class LayoutVersion(UUIDTimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        REVIEW = "review", "Review"
        APPROVED = "approved", "Approved"
        SUPERSEDED = "superseded", "Superseded"

    class AuthorType(models.TextChoices):
        USER = "user", "User"
        SOLVER = "solver", "Solver"
        AI = "ai", "AI assistant"

    layout = models.ForeignKey(Layout, on_delete=models.CASCADE, related_name="versions")
    site_version = models.ForeignKey(
        SiteVersion, on_delete=models.PROTECT, related_name="layout_versions"
    )
    revision = models.PositiveIntegerField()
    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="children",
        null=True,
        blank=True,
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    author_type = models.CharField(
        max_length=10, choices=AuthorType.choices, default=AuthorType.USER
    )
    author = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="layout_versions",
        null=True,
        blank=True,
    )
    rule_set_version = models.CharField(max_length=80, default="prototype-v1")
    engine_version = models.CharField(max_length=80, blank=True)
    input_snapshot = models.JSONField(default=dict)
    result_summary = models.JSONField(default=dict)
    canonical_hash = models.CharField(max_length=64, db_index=True)

    class Meta:
        ordering = ("layout", "-revision")
        constraints = [
            models.UniqueConstraint(
                fields=("layout", "revision"), name="planning_unique_layout_revision"
            )
        ]


class LayoutItem(UUIDTimeStampedModel):
    layout_version = models.ForeignKey(
        LayoutVersion, on_delete=models.CASCADE, related_name="items"
    )
    cultivar = models.ForeignKey(
        PlantCultivar, on_delete=models.PROTECT, related_name="layout_items"
    )
    stable_id = models.UUIDField(default=uuid.uuid4)
    x_m = models.DecimalField(max_digits=10, decimal_places=3)
    y_m = models.DecimalField(max_digits=10, decimal_places=3)
    rotation_deg = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    scale = models.DecimalField(max_digits=6, decimal_places=3, default=1)
    stage = models.CharField(max_length=20, default="mature")
    is_locked = models.BooleanField(default=False)
    source = models.CharField(max_length=20, default="solver")
    overrides = models.JSONField(default=dict, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("layout_version", "stable_id"), name="planning_unique_item_stable_id"
            )
        ]
        indexes = [models.Index(fields=("layout_version", "cultivar"))]


class ValidationIssue(UUIDTimeStampedModel):
    class Severity(models.TextChoices):
        INFO = "info", "Info"
        WARNING = "warning", "Warning"
        BLOCKING = "blocking", "Blocking"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        RESOLVED = "resolved", "Resolved"
        ACCEPTED = "accepted_exception", "Accepted exception"

    layout_version = models.ForeignKey(
        LayoutVersion, on_delete=models.CASCADE, related_name="validation_issues"
    )
    code = models.CharField(max_length=80)
    severity = models.CharField(max_length=12, choices=Severity.choices)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.OPEN)
    item_ids = models.JSONField(default=list)
    message = models.TextField()
    conflict_geometry = models.JSONField(null=True, blank=True)
    data = models.JSONField(default=dict, blank=True)
    accepted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="accepted_validation_issues",
        null=True,
        blank=True,
    )
    acceptance_reason = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=("layout_version", "status", "severity")),
            models.Index(fields=("code", "status")),
        ]


class SolverRun(UUIDTimeStampedModel):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"

    layout_version = models.ForeignKey(
        LayoutVersion, on_delete=models.CASCADE, related_name="solver_runs"
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.QUEUED)
    algorithm = models.CharField(max_length=80, default="grid-v2")
    random_seed = models.BigIntegerField(default=0)
    input_hash = models.CharField(max_length=64, db_index=True)
    score = models.JSONField(default=dict, blank=True)
    progress = models.PositiveSmallIntegerField(default=0)
    error_code = models.CharField(max_length=80, blank=True)
    error_message = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("status", "created_at"))]
