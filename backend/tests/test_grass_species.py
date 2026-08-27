from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from django.db.utils import IntegrityError
from rest_framework.test import APIClient

from catalog.models import GrassSpecies
from identity.models import Organization, User
from projects.models import Project, Site, SiteFeature, SiteVersion


@pytest.mark.django_db
class TestGrassSpeciesModel:
    def test_grass_species_created(self) -> None:
        grass = GrassSpecies.objects.create(
            slug="test-grass",
            common_name="Test Grass",
            scientific_name="Grass testus",
            liters_per_m2_week=Decimal("2.5"),
            sunlight="full_sun",
            foot_traffic_resistance="medium",
            source="Test Lab",
            valid_from=date(2024, 1, 1),
        )
        assert GrassSpecies.objects.count() == 1
        assert grass.common_name == "Test Grass"
        assert grass.provenance == "prototype_unverified"
        assert grass.source == "Test Lab"
        assert grass.valid_from is not None

    def test_grass_species_required_fields(self) -> None:
        """source + valid_from are REQUIRED (regla dura)."""
        with pytest.raises(IntegrityError):
            GrassSpecies.objects.create(
                slug="bad",
                common_name="Bad",
                scientific_name="Bad",
                liters_per_m2_week=Decimal("2.0"),
                sunlight="full_sun",
                foot_traffic_resistance="low",
            )

    def test_seed_catalog_idempotent(self) -> None:
        """Running seed_catalog 2x does not duplicate."""
        from catalog.management.commands.seed_catalog import Command

        cmd = Command()
        cmd.handle()
        count1 = GrassSpecies.objects.count()
        cmd.handle()
        count2 = GrassSpecies.objects.count()
        assert count1 == count2

    def test_lawn_zone_with_grass_species(self, user: User, organization: Organization) -> None:
        """SiteFeature lawn_zone can have FK to GrassSpecies."""
        grass = GrassSpecies.objects.create(
            slug="chepica",
            common_name="Chépica",
            scientific_name="Agrostis capillaris",
            liters_per_m2_week=Decimal("2.5"),
            sunlight="full_sun",
            foot_traffic_resistance="high",
            source="INIA",
            valid_from=date(2024, 1, 1),
        )

        project = Project.objects.create(organization=organization, name="Test")
        site = Site.objects.create(project=project)
        site_version = SiteVersion.objects.create(
            site=site, revision=1, width_m=Decimal("10.0"), height_m=Decimal("10.0")
        )
        feature = SiteFeature.objects.create(
            site_version=site_version,
            feature_type=SiteFeature.FeatureType.LAWN_ZONE,
            label="Lawn 1",
            geometry={"type": "rect", "x": 0, "y": 0, "width": 5, "height": 5},
            grass_species=grass,
        )
        assert feature.grass_species == grass
        assert feature.grass_species.liters_per_m2_week == Decimal("2.5")


@pytest.mark.django_db
class TestGrassSpeciesAPI:
    def test_list_grass_species_requires_auth(self) -> None:
        """GET /api/v1/grass-species/ requires authentication."""
        anonymous_client = APIClient()
        response = anonymous_client.get("/api/v1/grass-species/")
        assert response.status_code == 403

    def test_list_grass_species_authenticated(
        self, api_client: APIClient, user: User
    ) -> None:
        """GET /api/v1/grass-species/ returns list when authenticated."""
        api_client.force_authenticate(user)
        GrassSpecies.objects.create(
            slug="chepica",
            common_name="Chépica",
            scientific_name="Agrostis capillaris",
            liters_per_m2_week=Decimal("2.5"),
            sunlight="full_sun",
            foot_traffic_resistance="high",
            source="INIA",
            valid_from=date(2024, 1, 1),
        )
        response = api_client.get("/api/v1/grass-species/")
        assert response.status_code == 200
        data = response.json()
        assert len(data["results"]) >= 1
        grass_item = next(r for r in data["results"] if r["common_name"] == "Chépica")
        assert grass_item["liters_per_m2_week"] == "2.500"

    def test_retrieve_grass_species(self, api_client: APIClient, user: User) -> None:
        """GET /api/v1/grass-species/{id}/ returns detail."""
        api_client.force_authenticate(user)
        grass = GrassSpecies.objects.create(
            slug="chepica",
            common_name="Chépica",
            scientific_name="Agrostis capillaris",
            liters_per_m2_week=Decimal("2.5"),
            sunlight="full_sun",
            foot_traffic_resistance="high",
            source="INIA",
            valid_from=date(2024, 1, 1),
        )
        response = api_client.get(f"/api/v1/grass-species/{grass.id}/")
        assert response.status_code == 200
        data = response.json()
        assert data["common_name"] == "Chépica"
        assert data["source"] == "INIA"

    def test_public_grasses_endpoint_no_auth(self) -> None:
        """GET /api/grasses/ (public) does NOT require auth."""
        client = APIClient()
        GrassSpecies.objects.create(
            slug="chepica",
            common_name="Chépica",
            scientific_name="Agrostis capillaris",
            liters_per_m2_week=Decimal("2.5"),
            sunlight="full_sun",
            foot_traffic_resistance="high",
            source="INIA",
            valid_from=date(2024, 1, 1),
            provenance="verified",
        )
        response = client.get("/api/grasses/")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] >= 1
