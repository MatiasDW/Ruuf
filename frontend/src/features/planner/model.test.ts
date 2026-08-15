import { describe, expect, it } from "vitest";
import {
  buildInitialRequests,
  buildPlanPayload,
  defaultForm,
  formatIssueReason,
  highestWaterNeed,
  shortLabel,
} from "./model";
import type { PlanResult, Plant } from "./types";

const plants: Plant[] = [
  {
    id: "quillay",
    name: "Quillay",
    category: "tree",
    clearance_radius_m: 2.5,
    structure_clearance_m: 2,
    sunlight: ["full_sun"],
    water_need: "low",
    liters_per_week: 60,
    style_tags: ["native"],
    color: "#123456",
  },
  {
    id: "lavender",
    name: "English Lavender",
    category: "flower",
    clearance_radius_m: 0.6,
    structure_clearance_m: 0.2,
    sunlight: ["full_sun"],
    water_need: "medium",
    liters_per_week: 8,
    style_tags: ["mediterranean"],
    color: "#654321",
  },
];

describe("planner model", () => {
  it("builds initial quantities by plant category", () => {
    expect(buildInitialRequests(plants)).toEqual([
      { plant_id: "quillay", name: "Quillay", quantity: 2 },
      { plant_id: "lavender", name: "English Lavender", quantity: 3 },
    ]);
  });

  it("omits zero-quantity requests from the API payload", () => {
    const payload = buildPlanPayload(defaultForm, [
      { plant_id: "quillay", name: "Quillay", quantity: 1 },
      { plant_id: "lavender", name: "English Lavender", quantity: 0 },
    ]);

    expect(payload.requests).toEqual([{ plant_id: "quillay", quantity: 1 }]);
    expect(payload.site.yard_width).toBe(24);
    expect(payload.obstacles[0]?.label).toBe("House");
  });

  it("reports the highest water need in a result", () => {
    const result = {
      placements: [{ water_need: "high" }, { water_need: "low" }],
    } as PlanResult;

    expect(highestWaterNeed(result)).toBe("high");
    expect(highestWaterNeed(null)).toBe("low");
  });

  it("creates compact marker labels", () => {
    expect(shortLabel("English Lavender")).toBe("EL");
    expect(shortLabel("Quillay")).toBe("Q");
  });

  it("translates known planner explanations for the customer", () => {
    expect(formatIssueReason("Needs partial_shade, shade but the site is full_sun.")).toBe(
      "Necesita sombra parcial, sombra, pero el terreno tiene sol directo.",
    );
    expect(
      formatIssueReason(
        "No remaining position satisfies yard bounds, obstacle clearance, and plant spacing.",
      ),
    ).toContain("distancias mínimas");
  });
});
