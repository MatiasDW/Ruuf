from __future__ import annotations

from django.urls import path

from api.views import GrassSpeciesPublicViewSet
from planning.compat_views import PlanCompatibilityView, PlantCatalogCompatibilityView

urlpatterns = [
    path("plants", PlantCatalogCompatibilityView.as_view(), name="compat-plants"),
    path("plan", PlanCompatibilityView.as_view(), name="compat-plan"),
    path(
        "grasses/",
        GrassSpeciesPublicViewSet.as_view({"get": "list"}),
        name="compat-grasses",
    ),
]
