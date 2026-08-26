from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from irrigation.models import IrrigationNetworkDesign, IrrigationZone
from projects.models import Project


@pytest.mark.django_db
def test_create_irrigation_network_design(
    seeded_catalog: None, api_client: APIClient, project: Project, valid_plan_payload: dict
) -> None:
    """Create irrigation network design via API."""
    generated = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    ).json()
    layout_id = generated["layout_id"]

    payload = {
        "water_source_x": 5.0,
        "water_source_y": 3.0,
        "main_pipe_route": [{"x": 5.0, "y": 3.0}, {"x": 9.0, "y": 6.0}],
        "num_main_pipes": 2,
    }
    response = api_client.post(
        f"/api/v1/layouts/{layout_id}/irrigation-network-design/", payload, format="json"
    )

    assert response.status_code == 201
    design = IrrigationNetworkDesign.objects.get(layout_id=layout_id)
    assert design.water_source_x == 5.0
    assert design.water_source_y == 3.0
    assert design.num_main_pipes == 2
    assert len(design.main_pipe_route) == 2


@pytest.mark.django_db
def test_get_irrigation_network_design(
    seeded_catalog: None, api_client: APIClient, project: Project, valid_plan_payload: dict
) -> None:
    """Retrieve irrigation network design via API."""
    generated = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    ).json()
    layout_id = generated["layout_id"]

    create_payload = {
        "water_source_x": 6.0,
        "water_source_y": 4.0,
        "main_pipe_route": [{"x": 6.0, "y": 4.0}],
        "num_main_pipes": 1,
    }
    api_client.post(
        f"/api/v1/layouts/{layout_id}/irrigation-network-design/", create_payload, format="json"
    )

    response = api_client.get(f"/api/v1/layouts/{layout_id}/irrigation-network-design/")
    assert response.status_code == 200
    data = response.json()
    assert float(data["water_source_x"]) == 6.0
    assert float(data["water_source_y"]) == 4.0
    assert data["num_main_pipes"] == 1


@pytest.mark.django_db
def test_update_irrigation_network_design(
    seeded_catalog: None, api_client: APIClient, project: Project, valid_plan_payload: dict
) -> None:
    """Update irrigation network design via PUT."""
    generated = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    ).json()
    layout_id = generated["layout_id"]

    create_payload = {"water_source_x": 5.0, "water_source_y": 3.0, "num_main_pipes": 1}
    api_client.post(
        f"/api/v1/layouts/{layout_id}/irrigation-network-design/", create_payload, format="json"
    )

    update_payload = {
        "water_source_x": 7.0,
        "water_source_y": 5.0,
        "num_main_pipes": 3,
    }
    response = api_client.put(
        f"/api/v1/layouts/{layout_id}/irrigation-network-design/", update_payload, format="json"
    )

    assert response.status_code == 200
    design = IrrigationNetworkDesign.objects.get(layout_id=layout_id)
    assert design.water_source_x == 7.0
    assert design.water_source_y == 5.0
    assert design.num_main_pipes == 3


@pytest.mark.django_db
def test_validate_water_source_inside_yard(
    seeded_catalog: None, api_client: APIClient, project: Project, valid_plan_payload: dict
) -> None:
    """Water source must be within yard bounds."""
    generated = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    ).json()
    layout_id = generated["layout_id"]

    yard_width = float(valid_plan_payload["site"]["yard_width"])

    invalid_payload = {
        "water_source_x": yard_width + 1,
        "water_source_y": 5.0,
        "num_main_pipes": 1,
    }
    response = api_client.post(
        f"/api/v1/layouts/{layout_id}/irrigation-network-design/",
        invalid_payload,
        format="json",
    )

    assert response.status_code == 400
    assert "Water source must be inside yard bounds" in str(response.data)


@pytest.mark.django_db
def test_network_design_num_pipes_bounds(
    seeded_catalog: None, api_client: APIClient, project: Project, valid_plan_payload: dict
) -> None:
    """num_main_pipes must be 1-4."""
    generated = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    ).json()
    layout_id = generated["layout_id"]

    valid_payload = {"water_source_x": 5.0, "water_source_y": 3.0, "num_main_pipes": 4}
    response = api_client.post(
        f"/api/v1/layouts/{layout_id}/irrigation-network-design/", valid_payload, format="json"
    )
    assert response.status_code == 201

    design = IrrigationNetworkDesign.objects.get(layout_id=layout_id)
    assert design.num_main_pipes == 4


@pytest.mark.django_db
def test_network_design_with_zones(
    seeded_catalog: None,
    api_client: APIClient,
    project: Project,
    valid_plan_payload: dict,
) -> None:
    """Irrigation network can be linked to zones."""
    generated = api_client.post(
        f"/api/v1/projects/{project.id}/generate-plan/", valid_plan_payload, format="json"
    ).json()
    layout_version_id = generated["layout_version_id"]

    zone = IrrigationZone.objects.create(
        layout_version_id=layout_version_id,
        name="Zone A",
        target_flow_l_min=10.0,
    )

    layout_id = generated["layout_id"]
    payload = {
        "water_source_x": 5.0,
        "water_source_y": 3.0,
        "num_main_pipes": 1,
        "zones": [str(zone.id)],
    }
    response = api_client.post(
        f"/api/v1/layouts/{layout_id}/irrigation-network-design/", payload, format="json"
    )

    assert response.status_code == 201
    design = IrrigationNetworkDesign.objects.get(layout_id=layout_id)
    assert design.zones.count() == 1
    assert design.zones.first().id == zone.id
