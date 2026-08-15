from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SiteInput(StrictModel):
    yard_width: float = Field(gt=0, le=10_000)
    yard_height: float = Field(gt=0, le=10_000)
    sunlight: Literal["full_sun", "partial_shade", "shade"] = "full_sun"
    style: Literal["mediterranean", "native", "formal", "lush"] = "mediterranean"


class IrrigationInput(StrictModel):
    water_price_clp_per_m3: float = Field(default=0, ge=0, le=10_000_000)
    fixed_charge_clp: float = Field(default=0, ge=0, le=1_000_000_000)


class PlantRequestInput(StrictModel):
    plant_id: str = Field(min_length=1, max_length=100)
    quantity: int = Field(ge=1, le=100)


class ObstacleInput(StrictModel):
    x: float = Field(ge=0, le=10_000)
    y: float = Field(ge=0, le=10_000)
    width: float = Field(gt=0, le=10_000)
    height: float = Field(gt=0, le=10_000)
    label: str = Field(default="Obstacle", min_length=1, max_length=100)


class PlanPayloadInput(StrictModel):
    site: SiteInput
    irrigation: IrrigationInput = Field(default_factory=IrrigationInput)
    requests: list[PlantRequestInput] = Field(min_length=1, max_length=500)
    obstacles: list[ObstacleInput] = Field(default_factory=list, max_length=100)


class RequestValidationError(ValueError):
    def __init__(self, errors: list[dict[str, object]]) -> None:
        super().__init__("Request validation failed.")
        self.errors = errors


def parse_plan_payload(payload: object, valid_plant_ids: set[str]) -> PlanPayloadInput:
    try:
        parsed = PlanPayloadInput.model_validate(payload)
    except ValidationError as error:
        details: list[dict[str, object]] = [
            {
                "field": ".".join(str(part) for part in item["loc"]),
                "code": item["type"],
                "message": item["msg"],
            }
            for item in error.errors(include_url=False, include_input=False)
        ]
        raise RequestValidationError(details) from error

    unknown_plants = sorted(
        {item.plant_id for item in parsed.requests if item.plant_id not in valid_plant_ids}
    )
    if unknown_plants:
        raise RequestValidationError(
            [
                {
                    "field": "requests.plant_id",
                    "code": "unknown_plant",
                    "message": f"Unknown plant id: {plant_id}",
                }
                for plant_id in unknown_plants
            ]
        )

    return parsed
