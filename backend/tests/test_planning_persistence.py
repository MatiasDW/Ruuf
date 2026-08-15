from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from audit.models import AuditEvent
from irrigation.models import IrrigationEstimate
from planning.models import Layout, LayoutItem, LayoutVersion, SolverRun, ValidationIssue
from planning.services import execute_solver_run
from projects.models import Project, SiteVersion


@pytest.mark.django_db
def test_generating_project_plan_persists_versioned_result(
    seeded_catalog: None,
    api_client: APIClient,
    project: Project,
    valid_plan_payload: dict[str, object],
) -> None:
    response = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    )

    assert response.status_code == 201
    assert response.json()["revision"] == 1
    layout = Layout.objects.get(pk=response.json()["layout_id"])
    version = LayoutVersion.objects.get(pk=response.json()["layout_version_id"])
    assert layout.current_revision == 1
    assert LayoutItem.objects.filter(layout_version=version).count() > 0
    assert IrrigationEstimate.objects.filter(layout_version=version).exists()
    assert SiteVersion.objects.filter(site__project=project).count() == 1
    assert AuditEvent.objects.filter(action="layout.generated", object_id=str(version.id)).exists()


@pytest.mark.django_db
def test_drag_revision_saves_conflict_ring_and_rejects_stale_revision(
    seeded_catalog: None,
    api_client: APIClient,
    project: Project,
    valid_plan_payload: dict[str, object],
) -> None:
    generated = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    ).json()
    layout_id = generated["layout_id"]
    payload = {
        "base_revision": 1,
        "items": [
            {"plant_id": "lavender", "x_m": 2, "y_m": 2},
            {"plant_id": "lavender", "x_m": 2.1, "y_m": 2},
        ],
    }

    response = api_client.post(f"/api/v1/layouts/{layout_id}/revisions/", payload, format="json")

    assert response.status_code == 201
    assert response.json()["revision"] == 2
    issue = response.json()["validation_issues"][0]
    assert issue["code"] == "plant_spacing"
    assert issue["conflict_geometry"]["type"] == "ring"
    assert ValidationIssue.objects.filter(layout_version_id=response.json()["id"]).exists()

    stale = api_client.post(f"/api/v1/layouts/{layout_id}/revisions/", payload, format="json")
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "revision_conflict"


@pytest.mark.django_db
def test_solver_run_records_score_without_mutating_snapshot(
    seeded_catalog: None,
    api_client: APIClient,
    project: Project,
    valid_plan_payload: dict[str, object],
) -> None:
    generated = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    ).json()
    version = LayoutVersion.objects.get(pk=generated["layout_version_id"])
    run = SolverRun.objects.create(
        layout_version=version, input_hash=version.canonical_hash, algorithm="grid-v2"
    )

    execute_solver_run(str(run.id))

    run.refresh_from_db()
    assert run.status == SolverRun.Status.SUCCEEDED
    assert run.progress == 100
    assert run.score["placed"] > 0
