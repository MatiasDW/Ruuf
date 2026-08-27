from __future__ import annotations

import hashlib
import json

from django.core.cache import cache
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from api.serializers import (
    CompatibilityPlanResponseSerializer,
    CompatibilityPlantSerializer,
    PlanInputSerializer,
)
from catalog.models import PlantCultivar
from planning.services import json_safe, run_plan, serialize_plan


class PlantCatalogCompatibilityView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses=CompatibilityPlantSerializer(many=True))
    def get(self, request: Request) -> Response:
        plants = PlantCultivar.objects.filter(is_active=True).order_by("display_name")
        return Response(
            [
                {
                    "id": plant.slug,
                    "name": plant.display_name,
                    "category": plant.category,
                    "clearance_radius_m": float(plant.recommended_spacing_m),
                    "structure_clearance_m": float(plant.structure_clearance_m),
                    "sunlight": plant.sunlight,
                    "water_need": plant.water_need,
                    "liters_per_week": float(plant.liters_per_week_estimate),
                    "style_tags": plant.style_tags,
                    "color": plant.color,
                    "image_url": plant.image_url,
                    "emoji": CompatibilityPlantSerializer.EMOJI_BY_CATEGORY.get(
                        plant.category, "🌿"
                    ),
                }
                for plant in plants
            ]
        )


class PlanCompatibilityView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=PlanInputSerializer, responses=CompatibilityPlanResponseSerializer)
    def post(self, request: Request) -> Response:
        serializer = PlanInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        encoded = json.dumps(json_safe(payload), separators=(",", ":"), sort_keys=True).encode()
        cache_key = f"compat-plan:{hashlib.sha256(encoded).hexdigest()}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        result, irrigation = run_plan(payload)
        response = serialize_plan(result, irrigation)
        cache.set(cache_key, response, timeout=300)
        return Response(response)
