import { describe, expect, it } from "vitest";
import {
  buildIrrigationZones,
  irrigationReachMeters,
  snapMeters,
  validatePlacements,
} from "./editor";
import { defaultForm } from "./model";
import type { Placement } from "./types";

const placement = (overrides: Partial<Placement> = {}): Placement => ({
  plant_id: "quillay",
  name: "Quillay",
  x: 12,
  y: 8,
  clearance_radius_m: 1,
  structure_clearance_m: 1,
  water_need: "low",
  liters_per_week: 60,
  color: "#537b56",
  ...overrides,
});

describe("garden editor geometry", () => {
  it("detects boundary, house, and plant-spacing conflicts", () => {
    const placements = [
      placement({ x: 0.5, y: 8 }),
      placement({ x: 5, y: 5 }),
      placement({ x: 5.5, y: 5 }),
    ];

    const validations = validatePlacements(placements, defaultForm);

    expect(validations[0]?.issues).toContain("boundary");
    expect(validations[1]?.issues).toEqual(expect.arrayContaining(["house", "spacing"]));
    expect(validations[2]?.issues).toEqual(expect.arrayContaining(["house", "spacing"]));
  });

  it("builds one irrigation hub per water need", () => {
    const zones = buildIrrigationZones([
      placement({ x: 2, y: 2, water_need: "low" }),
      placement({ x: 4, y: 4, water_need: "low" }),
      placement({ x: 10, y: 6, water_need: "high" }),
    ]);

    expect(zones).toHaveLength(2);
    expect(zones[0]).toMatchObject({ waterNeed: "low", x: 3, y: 3 });
    expect(zones[1]).toMatchObject({ waterNeed: "high", x: 10, y: 6 });
  });

  it("uses the open corner of an L-shaped house as plantable space", () => {
    const lShapedForm = { ...defaultForm, house_shape: "l_shape" as const };

    const [validation] = validatePlacements(
      [placement({ x: 10, y: 8, clearance_radius_m: 0.4, structure_clearance_m: 0.4 })],
      lShapedForm,
    );

    expect(validation?.issues).not.toContain("house");
  });

  it("snaps edits and bounds sprinkler reach", () => {
    expect(snapMeters(3.13)).toBe(3.25);
    expect(irrigationReachMeters(placement({ clearance_radius_m: 0.4 }))).toBe(0.8);
    expect(irrigationReachMeters(placement({ clearance_radius_m: 5 }))).toBe(2.4);
  });
});
