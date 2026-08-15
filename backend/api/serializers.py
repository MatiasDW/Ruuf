from __future__ import annotations

from decimal import Decimal
from typing import Any, cast

from django.db import transaction
from rest_framework import serializers

from audit.models import AuditEvent
from catalog.models import PlantCultivar, PlantRuleVersion, PlantSpecies
from finance.models import (
    Expense,
    PriceBook,
    PriceItem,
    ProjectBudget,
    QuoteItem,
    QuoteVersion,
)
from identity.models import Client, Membership, Organization, User
from irrigation.models import IrrigationEstimate, IrrigationZone, TariffVersion, WaterProvider
from planning.models import Layout, LayoutItem, LayoutVersion, SolverRun, ValidationIssue
from projects.models import Project, Site, SiteFeature, SiteVersion


class StrictSerializer(serializers.Serializer):
    def to_internal_value(self, data: Any) -> dict[str, Any]:
        if isinstance(data, dict):
            unknown = set(data) - set(self.fields)
            if unknown:
                raise serializers.ValidationError(
                    {field: ["Unknown field."] for field in sorted(unknown)}
                )
        return cast(dict[str, Any], super().to_internal_value(data))


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "display_name", "locale", "units")
        read_only_fields = ("id", "email")


class LoginSerializer(StrictSerializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False, write_only=True, max_length=256)


class CSRFTokenSerializer(serializers.Serializer):
    csrf_token = serializers.CharField(read_only=True)


class EmptySerializer(serializers.Serializer):
    pass


class CompatibilityPlantSerializer(serializers.Serializer):
    id = serializers.SlugField()
    name = serializers.CharField()
    category = serializers.CharField()
    clearance_radius_m = serializers.FloatField()
    structure_clearance_m = serializers.FloatField()
    sunlight = serializers.ListField(child=serializers.CharField())
    water_need = serializers.CharField()
    liters_per_week = serializers.FloatField()
    style_tags = serializers.ListField(child=serializers.CharField())
    color = serializers.CharField()


class CompatibilityPlanResponseSerializer(serializers.Serializer):
    summary = serializers.DictField()
    placements = serializers.ListField(child=serializers.DictField())
    unplaced = serializers.ListField(child=serializers.DictField())
    issues = serializers.ListField(child=serializers.DictField())
    irrigation = serializers.DictField()


class OrganizationSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = (
            "id",
            "name",
            "slug",
            "currency",
            "timezone",
            "retention_days",
            "is_active",
            "role",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "role", "created_at", "updated_at")

    def get_role(self, organization: Organization) -> str | None:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        membership = organization.memberships.filter(
            user=request.user, status=Membership.Status.ACTIVE
        ).first()
        return membership.role if membership else None

    @transaction.atomic
    def create(self, validated_data: dict[str, Any]) -> Organization:
        organization = Organization.objects.create(**validated_data)
        Membership.objects.create(
            organization=organization,
            user=self.context["request"].user,
            role=Membership.Role.OWNER,
            status=Membership.Status.ACTIVE,
        )
        return organization


class MembershipSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Membership
        fields = (
            "id",
            "organization",
            "user",
            "user_email",
            "role",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = (
            "id",
            "organization",
            "display_name",
            "email",
            "phone",
            "preferred_contact",
            "notes",
            "consent_recorded_at",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
        extra_kwargs = {"notes": {"write_only": True}}


class ProjectSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.display_name", read_only=True)

    class Meta:
        model = Project
        fields = (
            "id",
            "organization",
            "client",
            "client_name",
            "assigned_to",
            "name",
            "status",
            "output_level",
            "currency",
            "budget_min",
            "budget_max",
            "target_date",
            "tags",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        organization = attrs.get("organization") or getattr(self.instance, "organization", None)
        client = attrs.get("client")
        if client and organization and client.organization_id != organization.id:
            raise serializers.ValidationError({"client": "Client belongs to another organization."})
        minimum = attrs.get("budget_min")
        maximum = attrs.get("budget_max")
        if minimum is not None and maximum is not None and minimum > maximum:
            raise serializers.ValidationError({"budget_max": "Must be greater than budget_min."})
        return attrs


class SiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = (
            "id",
            "project",
            "commune",
            "region",
            "country",
            "address",
            "location_precision",
            "timezone",
            "water_provider_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
        extra_kwargs = {"address": {"write_only": True}}


class SiteFeatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteFeature
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class SiteVersionSerializer(serializers.ModelSerializer):
    features = SiteFeatureSerializer(many=True, read_only=True)

    class Meta:
        model = SiteVersion
        fields = (
            "id",
            "site",
            "revision",
            "method",
            "width_m",
            "height_m",
            "boundary",
            "orientation_deg",
            "precision_m",
            "sunlight",
            "preferred_style",
            "author",
            "approved_at",
            "features",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "author", "created_at", "updated_at")


class PlantSpeciesSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlantSpecies
        fields = "__all__"


class PlantRuleVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlantRuleVersion
        fields = "__all__"


class PlantCultivarSerializer(serializers.ModelSerializer):
    scientific_name = serializers.CharField(source="species.scientific_name", read_only=True)
    origin_chile = serializers.CharField(source="species.origin_chile", read_only=True)

    class Meta:
        model = PlantCultivar
        fields = (
            "id",
            "slug",
            "display_name",
            "cultivar_name",
            "scientific_name",
            "origin_chile",
            "category",
            "growth_habit",
            "mature_height_min_m",
            "mature_height_max_m",
            "canopy_radius_m",
            "recommended_spacing_m",
            "root_caution_radius_m",
            "structure_clearance_m",
            "sunlight",
            "water_need",
            "liters_per_week_estimate",
            "style_tags",
            "color",
            "provenance",
            "is_verified",
            "is_active",
            "created_at",
            "updated_at",
        )


class IrrigationEstimateSerializer(serializers.ModelSerializer):
    class Meta:
        model = IrrigationEstimate
        fields = "__all__"


class LayoutItemSerializer(serializers.ModelSerializer):
    plant_id = serializers.CharField(source="cultivar.slug", read_only=True)
    name = serializers.CharField(source="cultivar.display_name", read_only=True)
    clearance_radius_m = serializers.DecimalField(
        source="cultivar.recommended_spacing_m", max_digits=7, decimal_places=2, read_only=True
    )
    color = serializers.CharField(source="cultivar.color", read_only=True)

    class Meta:
        model = LayoutItem
        fields = (
            "id",
            "stable_id",
            "layout_version",
            "cultivar",
            "plant_id",
            "name",
            "x_m",
            "y_m",
            "rotation_deg",
            "scale",
            "stage",
            "is_locked",
            "source",
            "overrides",
            "clearance_radius_m",
            "color",
        )


class ValidationIssueSerializer(serializers.ModelSerializer):
    class Meta:
        model = ValidationIssue
        fields = "__all__"


class SolverRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = SolverRun
        fields = "__all__"
        read_only_fields = (
            "id",
            "status",
            "score",
            "progress",
            "error_code",
            "error_message",
            "started_at",
            "finished_at",
            "created_at",
            "updated_at",
        )


class LayoutVersionSerializer(serializers.ModelSerializer):
    items = LayoutItemSerializer(many=True, read_only=True)
    validation_issues = ValidationIssueSerializer(many=True, read_only=True)
    irrigation_estimates = IrrigationEstimateSerializer(many=True, read_only=True)

    class Meta:
        model = LayoutVersion
        fields = (
            "id",
            "layout",
            "site_version",
            "revision",
            "parent",
            "status",
            "author_type",
            "author",
            "rule_set_version",
            "engine_version",
            "result_summary",
            "canonical_hash",
            "items",
            "validation_issues",
            "irrigation_estimates",
            "created_at",
            "updated_at",
        )


class LayoutSerializer(serializers.ModelSerializer):
    class Meta:
        model = Layout
        fields = (
            "id",
            "project",
            "name",
            "objective",
            "status",
            "current_revision",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "current_revision", "created_at", "updated_at")


class WaterProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = WaterProvider
        fields = "__all__"


class TariffVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TariffVersion
        fields = "__all__"


class IrrigationZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = IrrigationZone
        fields = "__all__"


class PriceBookSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceBook
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class PriceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceItem
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class QuoteItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuoteItem
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class QuoteVersionSerializer(serializers.ModelSerializer):
    items = QuoteItemSerializer(many=True, read_only=True)

    class Meta:
        model = QuoteVersion
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class ProjectBudgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectBudget
        fields = "__all__"
        read_only_fields = (
            "id",
            "committed_amount",
            "actual_amount",
            "approved_by",
            "approved_at",
            "created_at",
            "updated_at",
        )


class ExpenseSerializer(serializers.ModelSerializer):
    total_amount = serializers.DecimalField(max_digits=16, decimal_places=2, read_only=True)

    class Meta:
        model = Expense
        fields = "__all__"
        read_only_fields = (
            "id",
            "submitted_by",
            "approved_by",
            "created_at",
            "updated_at",
        )

    def create(self, validated_data: dict[str, Any]) -> Expense:
        validated_data["total_amount"] = validated_data["net_amount"] + validated_data.get(
            "tax_amount", Decimal(0)
        )
        return cast(Expense, super().create(validated_data))

    def update(self, instance: Expense, validated_data: dict[str, Any]) -> Expense:
        net = validated_data.get("net_amount", instance.net_amount)
        tax = validated_data.get("tax_amount", instance.tax_amount)
        validated_data["total_amount"] = net + tax
        return cast(Expense, super().update(instance, validated_data))


class AuditEventSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True)

    class Meta:
        model = AuditEvent
        fields = "__all__"


class LocationInputSerializer(StrictSerializer):
    commune = serializers.CharField(max_length=120, required=False, allow_blank=True)
    region = serializers.CharField(max_length=120, required=False, allow_blank=True)
    country = serializers.CharField(max_length=2, required=False, default="CL")
    address = serializers.CharField(
        max_length=250, required=False, allow_blank=True, write_only=True
    )
    location_precision = serializers.ChoiceField(
        choices=("approximate", "exact"), required=False, default="approximate"
    )


class SitePlanInputSerializer(StrictSerializer):
    yard_width = serializers.DecimalField(max_digits=10, decimal_places=3, min_value=Decimal("0.1"))
    yard_height = serializers.DecimalField(
        max_digits=10, decimal_places=3, min_value=Decimal("0.1")
    )
    sunlight = serializers.ChoiceField(
        choices=("full_sun", "partial_shade", "shade"), default="full_sun"
    )
    style = serializers.ChoiceField(
        choices=("mediterranean", "native", "formal", "lush"), default="mediterranean"
    )
    method = serializers.ChoiceField(choices=SiteVersion.Method.choices, required=False)
    location = LocationInputSerializer(required=False)


class IrrigationPlanInputSerializer(StrictSerializer):
    water_price_clp_per_m3 = serializers.DecimalField(
        max_digits=14, decimal_places=4, min_value=Decimal("0"), default=Decimal("0")
    )
    sewer_price_clp_per_m3 = serializers.DecimalField(
        max_digits=14, decimal_places=4, min_value=Decimal("0"), default=Decimal("0")
    )
    fixed_charge_clp = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0"), default=Decimal("0")
    )
    efficiency = serializers.DecimalField(
        max_digits=4,
        decimal_places=3,
        min_value=Decimal("0.1"),
        max_value=Decimal("1"),
        default=Decimal("0.85"),
    )


class PlantRequestInputSerializer(StrictSerializer):
    plant_id = serializers.SlugField(max_length=120)
    quantity = serializers.IntegerField(min_value=1, max_value=100)


class ObstacleInputSerializer(StrictSerializer):
    x = serializers.DecimalField(max_digits=10, decimal_places=3, min_value=Decimal("0"))
    y = serializers.DecimalField(max_digits=10, decimal_places=3, min_value=Decimal("0"))
    width = serializers.DecimalField(max_digits=10, decimal_places=3, min_value=Decimal("0.01"))
    height = serializers.DecimalField(max_digits=10, decimal_places=3, min_value=Decimal("0.01"))
    label = serializers.CharField(max_length=120, default="Obstacle")


class PlanInputSerializer(StrictSerializer):
    site = SitePlanInputSerializer()
    irrigation = IrrigationPlanInputSerializer(required=False, default=dict)
    requests = PlantRequestInputSerializer(many=True, min_length=1, max_length=500)
    obstacles = ObstacleInputSerializer(many=True, required=False, default=list, max_length=100)
    layout_id = serializers.UUIDField(required=False)
    layout_name = serializers.CharField(max_length=180, required=False)
    objective = serializers.CharField(max_length=120, required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        requested = {item["plant_id"] for item in attrs["requests"]}
        known = set(
            PlantCultivar.objects.filter(slug__in=requested, is_active=True).values_list(
                "slug", flat=True
            )
        )
        unknown = sorted(requested - known)
        if unknown:
            raise serializers.ValidationError(
                {"requests": [f"Unknown or inactive plant id: {item}" for item in unknown]}
            )
        quantity = sum(item["quantity"] for item in attrs["requests"])
        if quantity > 500:
            raise serializers.ValidationError({"requests": "Total quantity cannot exceed 500."})
        return attrs


class RevisionItemSerializer(StrictSerializer):
    stable_id = serializers.UUIDField(required=False)
    plant_id = serializers.SlugField(max_length=120)
    x_m = serializers.DecimalField(max_digits=10, decimal_places=3)
    y_m = serializers.DecimalField(max_digits=10, decimal_places=3)
    rotation_deg = serializers.DecimalField(max_digits=6, decimal_places=2, required=False)
    scale = serializers.DecimalField(
        max_digits=6, decimal_places=3, min_value=Decimal("0.1"), required=False
    )
    is_locked = serializers.BooleanField(required=False)


class ReviseLayoutSerializer(StrictSerializer):
    base_revision = serializers.IntegerField(min_value=1)
    items = RevisionItemSerializer(many=True, max_length=500)

    def validate_items(self, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        requested = {str(item["plant_id"]) for item in items}
        known = set(
            PlantCultivar.objects.filter(slug__in=requested, is_active=True).values_list(
                "slug", flat=True
            )
        )
        unknown = sorted(requested - known)
        if unknown:
            raise serializers.ValidationError(
                [f"Unknown or inactive plant id: {item}" for item in unknown]
            )
        stable_ids = [item.get("stable_id") for item in items if item.get("stable_id")]
        if len(stable_ids) != len(set(stable_ids)):
            raise serializers.ValidationError("stable_id values must be unique within a revision.")
        return items
