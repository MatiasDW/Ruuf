from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from api.views import (
    AuditEventViewSet,
    ClientViewSet,
    CSRFView,
    ExpenseViewSet,
    IrrigationEstimateViewSet,
    IrrigationZoneViewSet,
    LayoutVersionViewSet,
    LayoutViewSet,
    LoginView,
    LogoutView,
    MembershipViewSet,
    OrganizationViewSet,
    PlantCultivarViewSet,
    PlantRuleVersionViewSet,
    PlantSpeciesViewSet,
    PriceBookViewSet,
    PriceItemViewSet,
    ProjectBudgetViewSet,
    ProjectViewSet,
    QuoteItemViewSet,
    QuoteVersionViewSet,
    SessionView,
    SiteFeatureViewSet,
    SiteVersionViewSet,
    SiteViewSet,
    SolverRunViewSet,
    TariffVersionViewSet,
    ValidationIssueViewSet,
    WaterProviderViewSet,
)

router = DefaultRouter()
router.register("organizations", OrganizationViewSet, basename="organization")
router.register("memberships", MembershipViewSet, basename="membership")
router.register("clients", ClientViewSet, basename="client")
router.register("projects", ProjectViewSet, basename="project")
router.register("sites", SiteViewSet, basename="site")
router.register("site-versions", SiteVersionViewSet, basename="site-version")
router.register("site-features", SiteFeatureViewSet, basename="site-feature")
router.register("plant-species", PlantSpeciesViewSet, basename="plant-species")
router.register("plant-cultivars", PlantCultivarViewSet, basename="plant-cultivar")
router.register("plant-rules", PlantRuleVersionViewSet, basename="plant-rule")
router.register("layouts", LayoutViewSet, basename="layout")
router.register("layout-versions", LayoutVersionViewSet, basename="layout-version")
router.register("validation-issues", ValidationIssueViewSet, basename="validation-issue")
router.register("solver-runs", SolverRunViewSet, basename="solver-run")
router.register("water-providers", WaterProviderViewSet, basename="water-provider")
router.register("tariffs", TariffVersionViewSet, basename="tariff")
router.register("irrigation-estimates", IrrigationEstimateViewSet, basename="irrigation-estimate")
router.register("irrigation-zones", IrrigationZoneViewSet, basename="irrigation-zone")
router.register("price-books", PriceBookViewSet, basename="price-book")
router.register("price-items", PriceItemViewSet, basename="price-item")
router.register("quotes", QuoteVersionViewSet, basename="quote")
router.register("quote-items", QuoteItemViewSet, basename="quote-item")
router.register("budgets", ProjectBudgetViewSet, basename="budget")
router.register("expenses", ExpenseViewSet, basename="expense")
router.register("audit-events", AuditEventViewSet, basename="audit-event")

urlpatterns = [
    path("auth/csrf", CSRFView.as_view(), name="auth-csrf"),
    path("auth/login", LoginView.as_view(), name="auth-login"),
    path("auth/logout", LogoutView.as_view(), name="auth-logout"),
    path("auth/me", SessionView.as_view(), name="auth-session"),
    path("", include(router.urls)),
]
