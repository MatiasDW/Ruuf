from __future__ import annotations

import hashlib
import json
import logging
import uuid
from dataclasses import asdict
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework.exceptions import APIException

from audit.services import record_audit_event
from catalog.models import PlantCultivar
from domain.irrigation import IrrigationResult, estimate_irrigation
from domain.planning import (
    ENGINE_VERSION,
    ConstraintIssue,
    Placement,
    PlanResult,
    PlantRequest,
    PlantSpec,
    RectangleObstacle,
    plan_landscape,
    validate_layout,
)
from identity.models import User
from irrigation.models import IrrigationEstimate
from planning.models import Layout, LayoutItem, LayoutVersion, SolverRun, ValidationIssue
from projects.models import Project, Site, SiteFeature, SiteVersion

logger = logging.getLogger(__name__)


class RevisionConflict(APIException):
    status_code = 409
    default_detail = "The layout was modified by another session."
    default_code = "revision_conflict"


def json_safe(value: object) -> Any:
    return json.loads(json.dumps(value, default=str, sort_keys=True))


def canonical_hash(value: object) -> str:
    encoded = json.dumps(json_safe(value), separators=(",", ":"), sort_keys=True).encode()
    return hashlib.sha256(encoded).hexdigest()


def catalog_specs() -> list[PlantSpec]:
    cultivars = PlantCultivar.objects.filter(is_active=True).order_by("display_name")
    return [
        PlantSpec(
            id=cultivar.slug,
            name=cultivar.display_name,
            category=cultivar.category,
            clearance_radius_m=float(cultivar.recommended_spacing_m),
            structure_clearance_m=float(cultivar.structure_clearance_m),
            sunlight=tuple(cultivar.sunlight),
            water_need=cultivar.water_need,
            liters_per_week=float(cultivar.liters_per_week_estimate),
            style_tags=tuple(cultivar.style_tags),
            color=cultivar.color,
        )
        for cultivar in cultivars
    ]


def payload_obstacles(payload: dict[str, Any]) -> tuple[RectangleObstacle, ...]:
    return tuple(
        RectangleObstacle(
            x=float(item["x"]),
            y=float(item["y"]),
            width=float(item["width"]),
            height=float(item["height"]),
            label=str(item.get("label", "Obstacle")),
        )
        for item in payload.get("obstacles", [])
    )


def run_plan(payload: dict[str, Any]) -> tuple[PlanResult, IrrigationResult]:
    site = payload["site"]
    result = plan_landscape(
        yard_width=float(site["yard_width"]),
        yard_height=float(site["yard_height"]),
        requests=(
            PlantRequest(plant_id=str(item["plant_id"]), quantity=int(item["quantity"]))
            for item in payload["requests"]
        ),
        plant_catalog=catalog_specs(),
        sunlight=str(site.get("sunlight", "full_sun")),
        preferred_style=str(site.get("style", "mediterranean")),
        obstacles=payload_obstacles(payload),
    )
    irrigation = payload.get("irrigation", {})
    irrigation_result = estimate_irrigation(
        result.placements,
        variable_water_price_clp_per_m3=Decimal(str(irrigation.get("water_price_clp_per_m3", 0))),
        fixed_charge_clp=Decimal(str(irrigation.get("fixed_charge_clp", 0))),
        sewer_price_clp_per_m3=Decimal(str(irrigation.get("sewer_price_clp_per_m3", 0))),
        efficiency=Decimal(str(irrigation.get("efficiency", "0.85"))),
    )
    return result, irrigation_result


def serialize_irrigation(result: IrrigationResult) -> dict[str, object]:
    return {
        "weekly_liters": float(result.weekly_liters),
        "monthly_m3": float(result.monthly_cubic_meters),
        "monthly_variable_cost_clp": int(result.incremental_cost_clp),
        "monthly_total_cost_clp": int(result.projected_bill_cost_clp),
        "low_monthly_m3": float(result.low_monthly_cubic_meters),
        "high_monthly_m3": float(result.high_monthly_cubic_meters),
        "fixed_charge_clp": int(result.fixed_charge_clp),
        "water_rate_clp_per_m3": float(result.variable_rate_clp_per_m3),
        "sewer_rate_clp_per_m3": float(result.sewer_rate_clp_per_m3),
        "efficiency": float(result.efficiency),
    }


def serialize_plan(result: Any, irrigation: IrrigationResult) -> dict[str, object]:
    return {
        "summary": {
            "requested_items": len(result.placements) + len(result.unplaced),
            "placed_items": len(result.placements),
            "unplaced_items": len(result.unplaced),
            "grid_step_m": result.grid_step_m,
            "fits": len(result.unplaced) == 0,
            "engine_version": result.engine_version,
            "blocking_issues": sum(1 for issue in result.issues if issue.severity == "blocking"),
        },
        "placements": [asdict(item) for item in result.placements],
        "unplaced": [asdict(item) for item in result.unplaced],
        "issues": [asdict(item) for item in result.issues],
        "irrigation": serialize_irrigation(irrigation),
    }


def _next_site_version(project: Project, user: User, payload: dict[str, Any]) -> SiteVersion:
    site_data = payload["site"]
    site, _ = Site.objects.get_or_create(project=project)
    supplied_location = site_data.get("location", {})
    for field in ("commune", "region", "country", "address", "location_precision"):
        if field in supplied_location:
            setattr(site, field, supplied_location[field])
    site.save()

    current_revision = (
        SiteVersion.objects.select_for_update()
        .filter(site=site)
        .aggregate(max_revision=Max("revision"))["max_revision"]
        or 0
    )
    site_version = SiteVersion.objects.create(
        site=site,
        revision=current_revision + 1,
        method=site_data.get("method", SiteVersion.Method.CLIENT_REPORTED),
        width_m=site_data["yard_width"],
        height_m=site_data["yard_height"],
        boundary={
            "type": "Polygon",
            "coordinates": [
                [
                    [0, 0],
                    [float(site_data["yard_width"]), 0],
                    [float(site_data["yard_width"]), float(site_data["yard_height"])],
                    [0, float(site_data["yard_height"])],
                    [0, 0],
                ]
            ],
        },
        sunlight=site_data.get("sunlight", "full_sun"),
        preferred_style=site_data.get("style", "mediterranean"),
        author=user,
    )
    SiteFeature.objects.bulk_create(
        [
            SiteFeature(
                site_version=site_version,
                feature_type=SiteFeature.FeatureType.HOUSE
                if str(item.get("label", "")).lower() == "house"
                else SiteFeature.FeatureType.OTHER,
                label=item.get("label", "Obstacle"),
                geometry={
                    "type": "rectangle",
                    "x": float(item["x"]),
                    "y": float(item["y"]),
                    "width": float(item["width"]),
                    "height": float(item["height"]),
                },
                plantable=False,
            )
            for item in payload.get("obstacles", [])
        ]
    )
    return site_version


def _save_irrigation_estimate(
    layout_version: LayoutVersion, result: IrrigationResult
) -> IrrigationEstimate:
    return IrrigationEstimate.objects.create(
        layout_version=layout_version,
        scenario="baseline",
        weekly_liters=result.weekly_liters,
        monthly_cubic_meters=result.monthly_cubic_meters,
        low_monthly_cubic_meters=result.low_monthly_cubic_meters,
        high_monthly_cubic_meters=result.high_monthly_cubic_meters,
        incremental_cost_clp=result.incremental_cost_clp,
        projected_bill_cost_clp=result.projected_bill_cost_clp,
        assumptions={
            "efficiency": str(result.efficiency),
            "fixed_charge_clp": str(result.fixed_charge_clp),
            "variable_rate_clp_per_m3": str(result.variable_rate_clp_per_m3),
            "sewer_rate_clp_per_m3": str(result.sewer_rate_clp_per_m3),
            "weeks_per_month": "4.345",
        },
        confidence="prototype",
    )


@transaction.atomic
def persist_generated_plan(
    *, project: Project, user: User, payload: dict[str, Any], request: Any = None
) -> tuple[LayoutVersion, dict[str, object]]:
    result, irrigation_result = run_plan(payload)
    response = serialize_plan(result, irrigation_result)
    site_version = _next_site_version(project, user, payload)

    layout_id = payload.get("layout_id")
    if layout_id:
        layout = Layout.objects.select_for_update().get(id=layout_id, project=project)
    else:
        layout = Layout.objects.create(
            project=project,
            name=payload.get("layout_name", "Generated proposal"),
            objective=payload.get("objective", "balanced"),
        )
        layout = Layout.objects.select_for_update().get(pk=layout.pk)

    revision = layout.current_revision + 1
    previous = layout.versions.filter(revision=layout.current_revision).first()
    snapshot = json_safe(payload)
    version = LayoutVersion.objects.create(
        layout=layout,
        site_version=site_version,
        revision=revision,
        parent=previous,
        author_type=LayoutVersion.AuthorType.SOLVER,
        author=user,
        engine_version=ENGINE_VERSION,
        input_snapshot=snapshot,
        result_summary=response["summary"],
        canonical_hash=canonical_hash({"input": snapshot, "placements": response["placements"]}),
    )
    cultivar_index = {
        item.slug: item
        for item in PlantCultivar.objects.filter(
            slug__in={placement.plant_id for placement in result.placements}
        )
    }
    LayoutItem.objects.bulk_create(
        [
            LayoutItem(
                layout_version=version,
                cultivar=cultivar_index[placement.plant_id],
                x_m=Decimal(str(placement.x)),
                y_m=Decimal(str(placement.y)),
                source="solver",
            )
            for placement in result.placements
        ]
    )
    ValidationIssue.objects.bulk_create(
        [
            ValidationIssue(
                layout_version=version,
                code="plant_not_placed",
                severity=ValidationIssue.Severity.BLOCKING,
                item_ids=[],
                message=item.reason,
                data={"plant_id": item.plant_id, "suggestions": list(item.suggestions)},
            )
            for item in result.unplaced
        ]
    )
    _save_irrigation_estimate(version, irrigation_result)
    layout.current_revision = revision
    layout.save(update_fields=("current_revision", "updated_at"))
    record_audit_event(
        organization=project.organization,
        actor=user,
        action="layout.generated",
        instance=version,
        request=request,
        changes={"revision": revision, "summary": response["summary"]},
    )
    response["layout_id"] = str(layout.id)
    response["layout_version_id"] = str(version.id)
    response["revision"] = version.revision
    return version, response


def _obstacles_for_version(site_version: SiteVersion) -> tuple[RectangleObstacle, ...]:
    obstacles: list[RectangleObstacle] = []
    for feature in site_version.features.all():
        if feature.plantable:
            continue
        geometry = feature.geometry
        # El flujo legado guarda "rectangle"; la API de BE-106 guarda "rect".
        if geometry.get("type") not in ("rectangle", "rect"):
            continue
        obstacles.append(
            RectangleObstacle(
                x=float(geometry["x"]),
                y=float(geometry["y"]),
                width=float(geometry["width"]),
                height=float(geometry["height"]),
                label=feature.label,
                feature_type=feature.feature_type,
            )
        )
    return tuple(obstacles)


def _issue_model(version: LayoutVersion, issue: ConstraintIssue) -> ValidationIssue:
    item_ids = [issue.plant_id]
    if issue.related_plant_id:
        item_ids.append(issue.related_plant_id)
    return ValidationIssue(
        layout_version=version,
        code=issue.code,
        severity=issue.severity,
        item_ids=item_ids,
        message=issue.message,
        conflict_geometry=issue.conflict_geometry,
        data={
            "required_distance_m": issue.required_distance_m,
            "actual_distance_m": issue.actual_distance_m,
        },
    )


@transaction.atomic
def revise_layout(
    *,
    layout: Layout,
    base_revision: int,
    items: list[dict[str, Any]],
    user: User,
    request: Any = None,
) -> LayoutVersion:
    locked_layout = (
        Layout.objects.select_for_update().select_related("project__organization").get(pk=layout.pk)
    )
    if locked_layout.current_revision != base_revision:
        raise RevisionConflict(
            detail={
                "message": "The layout has a newer revision.",
                "expected_revision": base_revision,
                "current_revision": locked_layout.current_revision,
            }
        )
    parent = locked_layout.versions.select_related("site_version").get(revision=base_revision)
    cultivars = {
        item.slug: item
        for item in PlantCultivar.objects.filter(slug__in={str(item["plant_id"]) for item in items})
    }
    placements: list[Placement] = []
    stable_ids: list[uuid.UUID] = []
    for item in items:
        cultivar = cultivars[str(item["plant_id"])]
        stable_ids.append(item.get("stable_id") or uuid.uuid4())
        placements.append(
            Placement(
                plant_id=str(stable_ids[-1]),
                name=cultivar.display_name,
                x=float(item["x_m"]),
                y=float(item["y_m"]),
                clearance_radius_m=float(cultivar.recommended_spacing_m),
                structure_clearance_m=float(cultivar.structure_clearance_m),
                water_need=cultivar.water_need,
                liters_per_week=float(cultivar.liters_per_week_estimate),
                color=cultivar.color,
            )
        )

    site_version = parent.site_version
    issues = validate_layout(
        placements,
        yard_width=float(site_version.width_m),
        yard_height=float(site_version.height_m),
        obstacles=_obstacles_for_version(site_version),
    )
    revision = base_revision + 1
    snapshot = json_safe(parent.input_snapshot)
    snapshot["manual_revision"] = {
        "base_revision": base_revision,
        "items": json_safe(items),
    }
    version = LayoutVersion.objects.create(
        layout=locked_layout,
        site_version=site_version,
        revision=revision,
        parent=parent,
        author_type=LayoutVersion.AuthorType.USER,
        author=user,
        engine_version="manual-v1",
        input_snapshot=snapshot,
        result_summary={
            "placed_items": len(items),
            "blocking_issues": sum(1 for issue in issues if issue.severity == "blocking"),
            "fits": not any(issue.severity == "blocking" for issue in issues),
        },
        canonical_hash=canonical_hash(snapshot),
    )
    LayoutItem.objects.bulk_create(
        [
            LayoutItem(
                layout_version=version,
                cultivar=cultivars[str(item["plant_id"])],
                stable_id=stable_id,
                x_m=item["x_m"],
                y_m=item["y_m"],
                rotation_deg=item.get("rotation_deg", 0),
                scale=item.get("scale", 1),
                is_locked=item.get("is_locked", False),
                source="user",
            )
            for item, stable_id in zip(items, stable_ids, strict=True)
        ]
    )
    ValidationIssue.objects.bulk_create([_issue_model(version, issue) for issue in issues])
    irrigation_payload = parent.input_snapshot.get("irrigation", {})
    irrigation_result = estimate_irrigation(
        placements,
        variable_water_price_clp_per_m3=Decimal(
            str(irrigation_payload.get("water_price_clp_per_m3", 0))
        ),
        fixed_charge_clp=Decimal(str(irrigation_payload.get("fixed_charge_clp", 0))),
        sewer_price_clp_per_m3=Decimal(str(irrigation_payload.get("sewer_price_clp_per_m3", 0))),
        efficiency=Decimal(str(irrigation_payload.get("efficiency", "0.85"))),
    )
    _save_irrigation_estimate(version, irrigation_result)
    locked_layout.current_revision = revision
    locked_layout.save(update_fields=("current_revision", "updated_at"))
    record_audit_event(
        organization=locked_layout.project.organization,
        actor=user,
        action="layout.revised",
        instance=version,
        request=request,
        changes={"base_revision": base_revision, "revision": revision},
    )
    return version


def execute_solver_run(run_id: str) -> None:
    run = SolverRun.objects.select_related("layout_version").get(pk=run_id)
    run.status = SolverRun.Status.RUNNING
    run.progress = 10
    run.started_at = timezone.now()
    run.save(update_fields=("status", "progress", "started_at", "updated_at"))
    try:
        result, irrigation = run_plan(run.layout_version.input_snapshot)
        run.score = {
            "placed": len(result.placements),
            "unplaced": len(result.unplaced),
            "monthly_m3": str(irrigation.monthly_cubic_meters),
        }
        run.status = SolverRun.Status.SUCCEEDED
        run.progress = 100
    except Exception as error:
        logger.exception("solver_run_failed", extra={"solver_run_id": str(run.id)})
        run.status = SolverRun.Status.FAILED
        run.error_code = type(error).__name__
        run.error_message = str(error)[:1000]
        raise
    finally:
        run.finished_at = timezone.now()
        run.save(
            update_fields=(
                "status",
                "progress",
                "score",
                "error_code",
                "error_message",
                "finished_at",
                "updated_at",
            )
        )
