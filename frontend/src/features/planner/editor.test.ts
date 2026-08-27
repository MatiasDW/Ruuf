import { describe, it, expect } from "vitest";
import {
  pointInPolygon,
  distanceToPolygon,
  polygonLabelAnchor,
  polygonSelfIntersects,
  buildIrrigationZones,
} from "./editor";
import type { Placement, Point, WaterNeed } from "./types";

function makePlacement(overrides: Partial<Placement>): Placement {
  return {
    plant_id: "p",
    name: "Planta",
    x: 0,
    y: 0,
    clearance_radius_m: 1,
    structure_clearance_m: 1,
    water_need: "medium",
    liters_per_week: 10,
    color: "#000",
    ...overrides,
  };
}

describe("Polygon geometry helpers", () => {
  describe("pointInPolygon", () => {
    const square: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    it("returns true for point inside polygon", () => {
      expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    });

    it("returns false for point outside polygon", () => {
      expect(pointInPolygon({ x: 15, y: 15 }, square)).toBe(false);
    });

    it("returns false for point on the left of a polygon", () => {
      expect(pointInPolygon({ x: -5, y: 5 }, square)).toBe(false);
    });

    it("handles triangle", () => {
      const triangle: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ];
      expect(pointInPolygon({ x: 5, y: 5 }, triangle)).toBe(true);
      expect(pointInPolygon({ x: 10, y: 10 }, triangle)).toBe(false);
    });
  });

  describe("distanceToPolygon", () => {
    const square: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    it("returns 0 for point on edge", () => {
      expect(distanceToPolygon({ x: 5, y: 0 }, square)).toBe(0);
    });

    it("returns distance to nearest edge", () => {
      const dist = distanceToPolygon({ x: 15, y: 5 }, square);
      expect(dist).toBeCloseTo(5, 1);
    });

    it("returns distance to corner for corner-adjacent point", () => {
      const dist = distanceToPolygon({ x: 11, y: 11 }, square);
      expect(dist).toBeCloseTo(Math.sqrt(2), 1);
    });

    it("handles point inside polygon", () => {
      const dist = distanceToPolygon({ x: 5, y: 5 }, square);
      expect(dist).toBe(5);
    });
  });

  describe("polygonSelfIntersects", () => {
    it("returns false for non-self-intersecting square", () => {
      const square: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];
      expect(polygonSelfIntersects(square)).toBe(false);
    });

    it("returns false for valid triangle", () => {
      const triangle: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ];
      expect(polygonSelfIntersects(triangle)).toBe(false);
    });

    it("returns true for self-intersecting polygon (figure-8)", () => {
      const bowtie: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
      ];
      expect(polygonSelfIntersects(bowtie)).toBe(true);
    });

    it("returns false for L-shape", () => {
      const lshape: Point[] = [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 5 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];
      expect(polygonSelfIntersects(lshape)).toBe(false);
    });

    it("returns true for star-like intersection", () => {
      const star: Point[] = [
        { x: 5, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 4 },
        { x: 10, y: 4 },
        { x: 0, y: 10 },
      ];
      expect(polygonSelfIntersects(star)).toBe(true);
    });
  });
});

describe("buildIrrigationZones with lawn zones", () => {
  it("includes lawn zones in irrigation zones", () => {
    const placements = [
      makePlacement({
        plant_id: "plant1",
        x: 2,
        y: 2,
        water_need: "medium" as WaterNeed,
      }),
    ];

    const lawnZones = [
      {
        id: "lawn1",
        x: 5,
        y: 5,
        width: 3,
        height: 2,
        water_need: "medium" as WaterNeed,
      },
    ];

    const zones = buildIrrigationZones(placements, lawnZones);
    const mediumZone = zones.find((z) => z.waterNeed === "medium");

    expect(mediumZone).toBeDefined();
    if (mediumZone) {
      expect(mediumZone.placementIndexes).toContain(0);
      expect(mediumZone.lawnZoneIds).toContain("lawn1");
    }
  });

  it("calculates hub position including lawn zones", () => {
    const placements: Placement[] = [];

    const lawnZones = [
      {
        id: "lawn1",
        x: 0,
        y: 0,
        width: 4,
        height: 2,
        water_need: "medium" as WaterNeed,
      },
      {
        id: "lawn2",
        x: 6,
        y: 0,
        width: 4,
        height: 2,
        water_need: "medium" as WaterNeed,
      },
    ];

    const zones = buildIrrigationZones(placements, lawnZones);
    const mediumZone = zones.find((z) => z.waterNeed === "medium");

    expect(mediumZone).toBeDefined();
    if (mediumZone) {
      // Hub should be at centroid of both lawn zones: ((2, 1) + (8, 1)) / 2 = (5, 1)
      expect(mediumZone.x).toBeCloseTo(5, 1);
      expect(mediumZone.y).toBeCloseTo(1, 1);
    }
  });

  it("handles empty lawn zones array", () => {
    const placements = [
      makePlacement({
        plant_id: "plant1",
        x: 2,
        y: 2,
        water_need: "low" as WaterNeed,
      }),
    ];

    const zones = buildIrrigationZones(placements, []);
    const lowZone = zones.find((z) => z.waterNeed === "low");

    expect(lowZone).toBeDefined();
    if (lowZone) {
      expect(lowZone.lawnZoneIds).toHaveLength(0);
      expect(lowZone.placementIndexes).toHaveLength(1);
    }
  });
});

describe("polygonLabelAnchor", () => {
  it("uses the centroid for convex polygons", () => {
    const square: Point[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    const anchor = polygonLabelAnchor(square);
    expect(anchor.x).toBeCloseTo(2);
    expect(anchor.y).toBeCloseTo(2);
  });

  it("stays inside concave polygons where the centroid falls outside", () => {
    // Forma en C: el centro del bbox cae en el hueco.
    const cShape: Point[] = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 5 },
      { x: 6, y: 5 },
      { x: 6, y: 6 },
      { x: 0, y: 6 },
    ];
    const anchor = polygonLabelAnchor(cShape);
    expect(pointInPolygon(anchor, cShape)).toBe(true);
  });

  it("stays inside zigzag polygons", () => {
    const zigzag: Point[] = [
      { x: 1, y: 0 },
      { x: 3, y: 0 },
      { x: 8, y: 1 },
      { x: 2, y: 3 },
      { x: 7, y: 6 },
      { x: 0, y: 6 },
    ];
    const anchor = polygonLabelAnchor(zigzag);
    expect(pointInPolygon(anchor, zigzag)).toBe(true);
  });
});
