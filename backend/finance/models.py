from __future__ import annotations

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from common.models import UUIDTimeStampedModel
from identity.models import Organization, User
from planning.models import LayoutVersion
from projects.models import Project


class PriceBook(UUIDTimeStampedModel):
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="price_books"
    )
    name = models.CharField(max_length=180)
    version = models.PositiveIntegerField(default=1)
    currency = models.CharField(max_length=3, default="CLP")
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("organization", "-effective_from", "-version")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "name", "version"), name="finance_unique_price_book"
            )
        ]


class PriceItem(UUIDTimeStampedModel):
    class Category(models.TextChoices):
        PLANT = "plant", "Plant"
        MATERIAL = "material", "Material"
        EQUIPMENT = "equipment", "Equipment"
        LABOR = "labor", "Labor"
        TRANSPORT = "transport", "Transport"
        SUBCONTRACT = "subcontract", "Subcontract"
        OTHER = "other", "Other"

    price_book = models.ForeignKey(PriceBook, on_delete=models.CASCADE, related_name="items")
    code = models.CharField(max_length=80)
    description = models.CharField(max_length=240)
    category = models.CharField(max_length=20, choices=Category.choices)
    unit = models.CharField(max_length=30)
    unit_cost = models.DecimalField(
        max_digits=16, decimal_places=4, validators=[MinValueValidator(Decimal("0"))]
    )
    markup_percent = models.DecimalField(
        max_digits=7,
        decimal_places=3,
        default=0,
        validators=[MinValueValidator(Decimal("0"))],
    )
    source = models.CharField(max_length=180, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("price_book", "code"), name="finance_unique_price_item_code"
            )
        ]


class QuoteVersion(UUIDTimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        REVIEW = "review", "Review"
        SENT = "sent", "Sent"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"
        EXPIRED = "expired", "Expired"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="quotes")
    layout_version = models.ForeignKey(
        LayoutVersion,
        on_delete=models.PROTECT,
        related_name="quotes",
        null=True,
        blank=True,
    )
    version = models.PositiveIntegerField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    currency = models.CharField(max_length=3, default="CLP")
    subtotal = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    tax_total = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    valid_until = models.DateField(null=True, blank=True)
    terms = models.TextField(blank=True)

    class Meta:
        ordering = ("project", "-version")
        constraints = [
            models.UniqueConstraint(
                fields=("project", "version"), name="finance_unique_quote_version"
            )
        ]


class QuoteItem(UUIDTimeStampedModel):
    quote = models.ForeignKey(QuoteVersion, on_delete=models.CASCADE, related_name="items")
    price_item = models.ForeignKey(
        PriceItem, on_delete=models.SET_NULL, related_name="quote_items", null=True, blank=True
    )
    description = models.CharField(max_length=240)
    quantity = models.DecimalField(max_digits=14, decimal_places=3)
    unit = models.CharField(max_length=30)
    unit_cost = models.DecimalField(max_digits=16, decimal_places=4)
    unit_price = models.DecimalField(max_digits=16, decimal_places=4)
    tax_percent = models.DecimalField(max_digits=7, decimal_places=3, default=19)
    waste_percent = models.DecimalField(max_digits=7, decimal_places=3, default=0)
    is_optional = models.BooleanField(default=False)
    line_total = models.DecimalField(max_digits=16, decimal_places=2)


class ProjectBudget(UUIDTimeStampedModel):
    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name="budget")
    version = models.PositiveIntegerField(default=1)
    baseline_amount = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    forecast_amount = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    contingency_amount = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    committed_amount = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    actual_amount = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="approved_budgets",
        null=True,
        blank=True,
    )
    approved_at = models.DateTimeField(null=True, blank=True)


class Expense(UUIDTimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved"
        PAID = "paid", "Paid"
        REJECTED = "rejected", "Rejected"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="expenses")
    category = models.CharField(max_length=30)
    supplier = models.CharField(max_length=180, blank=True)
    description = models.CharField(max_length=240)
    net_amount = models.DecimalField(
        max_digits=16, decimal_places=2, validators=[MinValueValidator(Decimal("0"))]
    )
    tax_amount = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal("0"))],
    )
    total_amount = models.DecimalField(
        max_digits=16, decimal_places=2, validators=[MinValueValidator(Decimal("0"))]
    )
    currency = models.CharField(max_length=3, default="CLP")
    expense_date = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    document_reference = models.CharField(max_length=180, blank=True)
    submitted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="submitted_expenses",
        null=True,
        blank=True,
    )
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="approved_expenses",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ("-expense_date", "-created_at")
        indexes = [models.Index(fields=("project", "status", "expense_date"))]
