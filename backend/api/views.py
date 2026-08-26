from __future__ import annotations

import logging
from uuid import UUID

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import AnonymousUser
from django.db import transaction
from django.db.models import QuerySet
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from api.access import organization_ids_for, require_role
from api.permissions import OrganizationRolePermission
from api.serializers import (
    AuditEventSerializer,
    ClientSerializer,
    CSRFTokenSerializer,
    EmptySerializer,
    ErrorResponseSerializer,
    ExpenseSerializer,
    GeneratedPlanSerializer,
    IrrigationEstimateSerializer,
    IrrigationNetworkDesignSerializer,
    IrrigationZoneSerializer,
    LayoutSerializer,
    LayoutVersionSerializer,
    LoginSerializer,
    MembershipSerializer,
    OrganizationSerializer,
    PlanInputSerializer,
    PlantCultivarSerializer,
    PlantRuleVersionSerializer,
    PlantSpeciesSerializer,
    PriceBookSerializer,
    PriceItemSerializer,
    ProjectBudgetSerializer,
    ProjectSerializer,
    QuoteItemSerializer,
    QuoteVersionSerializer,
    ReviseLayoutSerializer,
    SiteFeatureSerializer,
    SiteSerializer,
    SiteVersionSerializer,
    SolverRunSerializer,
    TariffVersionSerializer,
    UserSerializer,
    ValidationIssueSerializer,
    WaterProviderSerializer,
)
from audit.models import AuditEvent
from audit.services import record_audit_event
from catalog.models import PlantCultivar, PlantRuleVersion, PlantSpecies
from finance.models import (
    Expense,
    PriceBook,
    PriceItem,
    ProjectBudget,
    QuoteItem,
    QuoteVersion,
)
from finance.services import project_finance_summary
from identity.access import ADMIN_ROLES, DESIGN_ROLES, FINANCE_ROLES
from identity.models import Client, Membership, Organization, User
from irrigation.models import (
    IrrigationEstimate,
    IrrigationNetworkDesign,
    IrrigationZone,
    TariffVersion,
    WaterProvider,
)
from planning.models import Layout, LayoutVersion, SolverRun, ValidationIssue
from planning.services import persist_generated_plan, revise_layout
from planning.tasks import run_solver_task
from projects.models import Project, Site, SiteFeature, SiteVersion

logger = logging.getLogger(__name__)


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CSRFView(APIView):
    authentication_classes: list[type] = []
    permission_classes = [AllowAny]

    @extend_schema(responses=CSRFTokenSerializer)
    def get(self, request: Request) -> Response:
        return Response({"csrf_token": get_token(request)})


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    authentication_classes: list[type] = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    @extend_schema(request=LoginSerializer, responses=UserSerializer)
    def post(self, request: Request) -> Response:
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request=request,
            email=serializer.validated_data["email"].lower(),
            password=serializer.validated_data["password"],
        )
        if user is None or not user.is_active:
            raise AuthenticationFailed("Invalid credentials.")
        login(request, user)
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=EmptySerializer, responses={204: None})
    def post(self, request: Request) -> Response:
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SessionView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=UserSerializer)
    def get(self, request: Request) -> Response:
        return Response(UserSerializer(request.user).data)

    @extend_schema(request=UserSerializer, responses=UserSerializer)
    def patch(self, request: Request) -> Response:
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class OrganizationViewSet(viewsets.ModelViewSet):
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated, OrganizationRolePermission]
    write_roles = ADMIN_ROLES

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return Organization.objects.filter(
            id__in=organization_ids_for(self.request.user), is_active=True
        ).prefetch_related("memberships")

    def perform_update(self, serializer: OrganizationSerializer) -> None:
        require_role(self.request.user, serializer.instance.id, ADMIN_ROLES)
        serializer.save()

    def perform_destroy(self, instance: Organization) -> None:
        require_role(self.request.user, instance.id, {Membership.Role.OWNER})
        instance.is_active = False
        instance.save(update_fields=("is_active", "updated_at"))


class MembershipViewSet(viewsets.ModelViewSet):
    serializer_class = MembershipSerializer
    permission_classes = [IsAuthenticated, OrganizationRolePermission]
    write_roles = ADMIN_ROLES

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return Membership.objects.filter(
            organization_id__in=organization_ids_for(self.request.user)
        ).select_related("organization", "user")

    def perform_create(self, serializer: MembershipSerializer) -> None:
        organization = serializer.validated_data["organization"]
        require_role(self.request.user, organization.id, ADMIN_ROLES)
        serializer.save()

    def perform_update(self, serializer: MembershipSerializer) -> None:
        require_role(self.request.user, serializer.instance.organization_id, ADMIN_ROLES)
        serializer.save()

    def perform_destroy(self, instance: Membership) -> None:
        require_role(self.request.user, instance.organization_id, ADMIN_ROLES)
        if instance.role == Membership.Role.OWNER:
            owner_count = Membership.objects.filter(
                organization=instance.organization,
                role=Membership.Role.OWNER,
                status=Membership.Status.ACTIVE,
            ).count()
            if owner_count <= 1:
                raise ValidationError("An organization must keep at least one active owner.")
        instance.delete()


class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated, OrganizationRolePermission]
    write_roles = DESIGN_ROLES

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return Client.objects.filter(
            organization_id__in=organization_ids_for(self.request.user)
        ).select_related("organization")

    def perform_create(self, serializer: ClientSerializer) -> None:
        organization = serializer.validated_data["organization"]
        require_role(self.request.user, organization.id, DESIGN_ROLES)
        serializer.save()

    def perform_update(self, serializer: ClientSerializer) -> None:
        require_role(self.request.user, serializer.instance.organization_id, DESIGN_ROLES)
        serializer.save()

    def perform_destroy(self, instance: Client) -> None:
        require_role(self.request.user, instance.organization_id, ADMIN_ROLES)
        instance.is_active = False
        instance.save(update_fields=("is_active", "updated_at"))


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, OrganizationRolePermission]
    write_roles = DESIGN_ROLES

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return Project.objects.filter(
            organization_id__in=organization_ids_for(self.request.user)
        ).select_related("organization", "client", "assigned_to")

    def perform_create(self, serializer: ProjectSerializer) -> None:
        organization = serializer.validated_data["organization"]
        require_role(self.request.user, organization.id, DESIGN_ROLES)
        project = serializer.save()
        record_audit_event(
            organization=organization,
            actor=self.request.user,
            action="project.created",
            instance=project,
            request=self.request,
        )

    def perform_update(self, serializer: ProjectSerializer) -> None:
        require_role(self.request.user, serializer.instance.organization_id, DESIGN_ROLES)
        serializer.save()

    @extend_schema(
        request=PlanInputSerializer,
        responses={201: GeneratedPlanSerializer, 400: ErrorResponseSerializer},
    )
    @action(detail=True, methods=("post",), url_path="generate-plan")
    def generate_plan(self, request: Request, pk: str | None = None) -> Response:
        project = self.get_object()
        require_role(request.user, project.organization_id, DESIGN_ROLES)
        serializer = PlanInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        layout_id = serializer.validated_data.get("layout_id")
        if layout_id and not project.layouts.filter(id=layout_id).exists():
            raise ValidationError({"layout_id": "Layout does not belong to this project."})
        _, response = persist_generated_plan(
            project=project,
            user=request.user,
            payload=serializer.validated_data,
            request=request,
        )
        return Response(response, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("get",), url_path="finance-summary")
    def finance_summary(self, request: Request, pk: str | None = None) -> Response:
        return Response(project_finance_summary(self.get_object()))


class SiteViewSet(viewsets.ModelViewSet):
    serializer_class = SiteSerializer
    permission_classes = [IsAuthenticated, OrganizationRolePermission]
    write_roles = DESIGN_ROLES

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return Site.objects.filter(
            project__organization_id__in=organization_ids_for(self.request.user)
        ).select_related("project__organization")

    def perform_create(self, serializer: SiteSerializer) -> None:
        project = serializer.validated_data["project"]
        require_role(self.request.user, project.organization_id, DESIGN_ROLES)
        serializer.save()

    def perform_update(self, serializer: SiteSerializer) -> None:
        require_role(self.request.user, serializer.instance.project.organization_id, DESIGN_ROLES)
        serializer.save()


class SiteVersionViewSet(viewsets.ModelViewSet):
    serializer_class = SiteVersionSerializer
    permission_classes = [IsAuthenticated, OrganizationRolePermission]
    write_roles = DESIGN_ROLES
    http_method_names = ("get", "post", "head", "options")

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return (
            SiteVersion.objects.filter(
                site__project__organization_id__in=organization_ids_for(self.request.user)
            )
            .select_related("site__project__organization", "author")
            .prefetch_related("features")
        )

    def perform_create(self, serializer: SiteVersionSerializer) -> None:
        site = serializer.validated_data["site"]
        require_role(self.request.user, site.project.organization_id, DESIGN_ROLES)
        serializer.save(author=self.request.user)


class SiteFeatureViewSet(viewsets.ModelViewSet):
    serializer_class = SiteFeatureSerializer
    permission_classes = [IsAuthenticated, OrganizationRolePermission]
    write_roles = DESIGN_ROLES

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return SiteFeature.objects.filter(
            site_version__site__project__organization_id__in=organization_ids_for(self.request.user)
        ).select_related("site_version__site__project")

    def perform_create(self, serializer: SiteFeatureSerializer) -> None:
        version = serializer.validated_data["site_version"]
        require_role(self.request.user, version.site.project.organization_id, DESIGN_ROLES)
        serializer.save()


class PlantSpeciesViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PlantSpecies.objects.all()
    serializer_class = PlantSpeciesSerializer
    permission_classes = [AllowAny]


class PlantCultivarViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PlantCultivar.objects.filter(is_active=True).select_related("species")
    serializer_class = PlantCultivarSerializer
    permission_classes = [AllowAny]


class PlantRuleVersionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PlantRuleVersion.objects.select_related("cultivar", "reviewed_by")
    serializer_class = PlantRuleVersionSerializer
    permission_classes = [AllowAny]


def layout_version_queryset(user: User | AnonymousUser) -> QuerySet[LayoutVersion]:
    return (
        LayoutVersion.objects.filter(
            layout__project__organization_id__in=organization_ids_for(user)
        )
        .select_related("layout__project__organization", "site_version", "author")
        .prefetch_related("items__cultivar", "validation_issues", "irrigation_estimates")
    )


class LayoutViewSet(viewsets.ModelViewSet):
    serializer_class = LayoutSerializer
    permission_classes = [IsAuthenticated, OrganizationRolePermission]
    write_roles = DESIGN_ROLES

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return Layout.objects.filter(
            project__organization_id__in=organization_ids_for(self.request.user)
        ).select_related("project__organization")

    def perform_create(self, serializer: LayoutSerializer) -> None:
        project = serializer.validated_data["project"]
        require_role(self.request.user, project.organization_id, DESIGN_ROLES)
        serializer.save()

    def perform_update(self, serializer: LayoutSerializer) -> None:
        require_role(self.request.user, serializer.instance.project.organization_id, DESIGN_ROLES)
        serializer.save()

    @extend_schema(
        request=ReviseLayoutSerializer,
        responses={
            201: LayoutVersionSerializer,
            400: ErrorResponseSerializer,
            409: ErrorResponseSerializer,
        },
    )
    @action(detail=True, methods=("post",), url_path="revisions")
    def create_revision(self, request: Request, pk: str | None = None) -> Response:
        layout = self.get_object()
        require_role(request.user, layout.project.organization_id, DESIGN_ROLES)
        serializer = ReviseLayoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        version = revise_layout(
            layout=layout,
            base_revision=serializer.validated_data["base_revision"],
            items=serializer.validated_data["items"],
            user=request.user,
            request=request,
        )
        return Response(LayoutVersionSerializer(version).data, status=status.HTTP_201_CREATED)

    @extend_schema(responses={200: LayoutVersionSerializer(many=True)})
    @create_revision.mapping.get
    def list_revisions(self, request: Request, pk: str | None = None) -> Response:
        """Revisions of a single layout, newest first, so a client can reopen the latest."""
        layout = self.get_object()
        versions = layout_version_queryset(request.user).filter(layout=layout).order_by("-revision")
        page = self.paginate_queryset(versions)
        if page is not None:
            return self.get_paginated_response(LayoutVersionSerializer(page, many=True).data)
        return Response(LayoutVersionSerializer(versions, many=True).data)

    @extend_schema(
        responses={200: IrrigationNetworkDesignSerializer, 201: IrrigationNetworkDesignSerializer}
    )
    @action(detail=True, methods=("get", "post", "put"), url_path="irrigation-network-design")
    def irrigation_network_design(self, request: Request, pk: str | None = None) -> Response:
        """Get or update irrigation network design for a layout."""
        layout = self.get_object()
        require_role(request.user, layout.project.organization_id, DESIGN_ROLES)

        if request.method == "GET":
            design = IrrigationNetworkDesign.objects.filter(layout=layout).first()
            if not design:
                return Response({"detail": "No irrigation network design found."}, status=404)
            return Response(IrrigationNetworkDesignSerializer(design).data)

        serializer = IrrigationNetworkDesignSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        site_version = (
            layout.versions.filter(revision=layout.current_revision)
            .select_related("site_version")
            .first()
        )
        if not site_version or not site_version.site_version:
            return Response(
                {"detail": "Layout has no site version."}, status=status.HTTP_400_BAD_REQUEST
            )

        yard_width = float(site_version.site_version.width_m)
        yard_height = float(site_version.site_version.height_m)

        x = float(validated.get("water_source_x", 0))
        y = float(validated.get("water_source_y", 0))
        if not (0 <= x <= yard_width and 0 <= y <= yard_height):
            msg = f"Water source must be inside yard bounds (0-{yard_width}m x 0-{yard_height}m)."
            return Response(
                {"detail": msg},
                status=status.HTTP_400_BAD_REQUEST,
            )

        design, created = IrrigationNetworkDesign.objects.update_or_create(
            layout=layout,
            defaults={
                "water_source_x": validated.get("water_source_x", 0),
                "water_source_y": validated.get("water_source_y", 0),
                "main_pipe_route": validated.get("main_pipe_route", []),
                "num_main_pipes": validated.get("num_main_pipes", 1),
            },
        )
        if "zones" in validated:
            design.zones.set(validated["zones"])

        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(IrrigationNetworkDesignSerializer(design).data, status=status_code)


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter(
                name="layout",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                description="Return only the versions of this layout.",
            )
        ]
    )
)
class LayoutVersionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LayoutVersionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):  # type: ignore[no-untyped-def]
        queryset = layout_version_queryset(self.request.user)
        layout_id = self.request.query_params.get("layout")
        if layout_id:
            try:
                layout_uuid = UUID(str(layout_id))
            except ValueError:
                raise ValidationError({"layout": "Must be a valid UUID."}) from None
            queryset = queryset.filter(layout_id=layout_uuid)
        return queryset

    @action(detail=True, methods=("post",))
    def optimize(self, request: Request, pk: str | None = None) -> Response:
        version = self.get_object()
        require_role(request.user, version.layout.project.organization_id, DESIGN_ROLES)
        solver_run = SolverRun.objects.create(
            layout_version=version,
            input_hash=version.canonical_hash,
            algorithm="grid-v2",
        )
        try:
            run_solver_task.delay(str(solver_run.id))
        except Exception as error:
            logger.exception("solver_enqueue_failed", extra={"solver_run_id": str(solver_run.id)})
            solver_run.status = SolverRun.Status.FAILED
            solver_run.error_code = "queue_unavailable"
            solver_run.error_message = str(error)[:1000]
            solver_run.finished_at = timezone.now()
            solver_run.save(
                update_fields=(
                    "status",
                    "error_code",
                    "error_message",
                    "finished_at",
                    "updated_at",
                )
            )
            return Response(
                {
                    "error": {
                        "code": "queue_unavailable",
                        "message": "The optimization queue is temporarily unavailable.",
                    }
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(SolverRunSerializer(solver_run).data, status=status.HTTP_202_ACCEPTED)


class ValidationIssueViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ValidationIssueSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return ValidationIssue.objects.filter(
            layout_version__layout__project__organization_id__in=organization_ids_for(
                self.request.user
            )
        )


class SolverRunViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SolverRunSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return SolverRun.objects.filter(
            layout_version__layout__project__organization_id__in=organization_ids_for(
                self.request.user
            )
        )


class WaterProviderViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = WaterProvider.objects.filter(is_active=True)
    serializer_class = WaterProviderSerializer
    permission_classes = [AllowAny]


class TariffVersionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TariffVersion.objects.select_related("provider")
    serializer_class = TariffVersionSerializer
    permission_classes = [AllowAny]


class IrrigationEstimateViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = IrrigationEstimateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return IrrigationEstimate.objects.filter(
            layout_version__layout__project__organization_id__in=organization_ids_for(
                self.request.user
            )
        )


class IrrigationZoneViewSet(viewsets.ModelViewSet):
    serializer_class = IrrigationZoneSerializer
    permission_classes = [IsAuthenticated, OrganizationRolePermission]
    write_roles = DESIGN_ROLES

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return IrrigationZone.objects.filter(
            layout_version__layout__project__organization_id__in=organization_ids_for(
                self.request.user
            )
        )

    def perform_create(self, serializer: IrrigationZoneSerializer) -> None:
        version = serializer.validated_data["layout_version"]
        require_role(self.request.user, version.layout.project.organization_id, DESIGN_ROLES)
        serializer.save()


class PriceBookViewSet(viewsets.ModelViewSet):
    serializer_class = PriceBookSerializer
    permission_classes = [IsAuthenticated, OrganizationRolePermission]
    write_roles = FINANCE_ROLES

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return PriceBook.objects.filter(organization_id__in=organization_ids_for(self.request.user))

    def perform_create(self, serializer: PriceBookSerializer) -> None:
        organization = serializer.validated_data["organization"]
        require_role(self.request.user, organization.id, FINANCE_ROLES)
        serializer.save()


class PriceItemViewSet(viewsets.ModelViewSet):
    serializer_class = PriceItemSerializer
    permission_classes = [IsAuthenticated, OrganizationRolePermission]
    write_roles = FINANCE_ROLES

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return PriceItem.objects.filter(
            price_book__organization_id__in=organization_ids_for(self.request.user)
        ).select_related("price_book")

    def perform_create(self, serializer: PriceItemSerializer) -> None:
        price_book = serializer.validated_data["price_book"]
        require_role(self.request.user, price_book.organization_id, FINANCE_ROLES)
        serializer.save()


class QuoteVersionViewSet(viewsets.ModelViewSet):
    serializer_class = QuoteVersionSerializer
    permission_classes = [IsAuthenticated, OrganizationRolePermission]
    write_roles = FINANCE_ROLES

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return QuoteVersion.objects.filter(
            project__organization_id__in=organization_ids_for(self.request.user)
        ).prefetch_related("items")

    def perform_create(self, serializer: QuoteVersionSerializer) -> None:
        project = serializer.validated_data["project"]
        require_role(self.request.user, project.organization_id, FINANCE_ROLES)
        serializer.save()


class QuoteItemViewSet(viewsets.ModelViewSet):
    serializer_class = QuoteItemSerializer
    permission_classes = [IsAuthenticated, OrganizationRolePermission]
    write_roles = FINANCE_ROLES

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return QuoteItem.objects.filter(
            quote__project__organization_id__in=organization_ids_for(self.request.user)
        ).select_related("quote__project")

    def perform_create(self, serializer: QuoteItemSerializer) -> None:
        quote = serializer.validated_data["quote"]
        require_role(self.request.user, quote.project.organization_id, FINANCE_ROLES)
        serializer.save()


class ProjectBudgetViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ProjectBudgetSerializer
    permission_classes = [IsAuthenticated, OrganizationRolePermission]
    write_roles = FINANCE_ROLES

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return ProjectBudget.objects.filter(
            project__organization_id__in=organization_ids_for(self.request.user)
        ).select_related("project__organization")

    def perform_create(self, serializer: ProjectBudgetSerializer) -> None:
        project = serializer.validated_data["project"]
        require_role(self.request.user, project.organization_id, FINANCE_ROLES)
        serializer.save()

    @action(detail=True, methods=("post",))
    def approve(self, request: Request, pk: str | None = None) -> Response:
        budget = self.get_object()
        require_role(request.user, budget.project.organization_id, FINANCE_ROLES)
        budget.approved_by = request.user
        budget.approved_at = timezone.now()
        budget.save(update_fields=("approved_by", "approved_at", "updated_at"))
        return Response(self.get_serializer(budget).data)


class ExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated, OrganizationRolePermission]
    write_roles = FINANCE_ROLES

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return Expense.objects.filter(
            project__organization_id__in=organization_ids_for(self.request.user)
        ).select_related("project__organization", "submitted_by", "approved_by")

    def perform_create(self, serializer: ExpenseSerializer) -> None:
        project = serializer.validated_data["project"]
        require_role(self.request.user, project.organization_id, FINANCE_ROLES)
        expense = serializer.save(submitted_by=self.request.user)
        record_audit_event(
            organization=project.organization,
            actor=self.request.user,
            action="expense.created",
            instance=expense,
            request=self.request,
            changes={"total_amount": str(expense.total_amount), "status": expense.status},
        )

    @action(detail=True, methods=("post",))
    @transaction.atomic
    def approve(self, request: Request, pk: str | None = None) -> Response:
        expense = self.get_object()
        require_role(request.user, expense.project.organization_id, FINANCE_ROLES)
        expense.status = Expense.Status.APPROVED
        expense.approved_by = request.user
        expense.save(update_fields=("status", "approved_by", "updated_at"))
        record_audit_event(
            organization=expense.project.organization,
            actor=request.user,
            action="expense.approved",
            instance=expense,
            request=request,
        )
        return Response(self.get_serializer(expense).data)


class AuditEventViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditEventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return AuditEvent.objects.filter(
            organization_id__in=organization_ids_for(self.request.user, ADMIN_ROLES)
        ).select_related("organization", "actor")
