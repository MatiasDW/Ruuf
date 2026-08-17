import type { Placement, PlannerForm, WaterNeed } from "./types";

export type PlacementIssueCode = "boundary" | "house" | "spacing";

export interface PlacementValidation {
  index: number;
  valid: boolean;
  issues: PlacementIssueCode[];
}

export interface IrrigationZone {
  waterNeed: WaterNeed;
  placementIndexes: number[];
  x: number;
  y: number;
}

export function validatePlacements(
  placements: Placement[],
  form: PlannerForm,
): PlacementValidation[] {
  const issues = placements.map(() => new Set<PlacementIssueCode>());

  placements.forEach((placement, index) => {
    const radius = placement.clearance_radius_m;
    if (
      placement.x - radius < 0 ||
      placement.y - radius < 0 ||
      placement.x + radius > form.yard_width ||
      placement.y + radius > form.yard_height
    ) {
      issues[index]?.add("boundary");
    }

    const structureRadius = Math.max(radius, placement.structure_clearance_m);
    if (circleIntersectsHouse(placement.x, placement.y, structureRadius, form)) {
      issues[index]?.add("house");
    }
  });

  for (let first = 0; first < placements.length; first += 1) {
    for (let second = first + 1; second < placements.length; second += 1) {
      const a = placements[first];
      const b = placements[second];
      if (!a || !b) {
        continue;
      }
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance < a.clearance_radius_m + b.clearance_radius_m) {
        issues[first]?.add("spacing");
        issues[second]?.add("spacing");
      }
    }
  }

  return issues.map((itemIssues, index) => ({
    index,
    valid: itemIssues.size === 0,
    issues: [...itemIssues],
  }));
}

export function buildIrrigationZones(placements: Placement[]): IrrigationZone[] {
  const grouped = new Map<WaterNeed, number[]>();
  placements.forEach((placement, index) => {
    grouped.set(placement.water_need, [...(grouped.get(placement.water_need) ?? []), index]);
  });

  return (["low", "medium", "high"] as WaterNeed[]).flatMap((waterNeed) => {
    const placementIndexes = grouped.get(waterNeed) ?? [];
    if (!placementIndexes.length) {
      return [];
    }
    const points = placementIndexes.flatMap((index) => {
      const placement = placements[index];
      return placement ? [placement] : [];
    });
    return [
      {
        waterNeed,
        placementIndexes,
        x: points.reduce((sum, placement) => sum + placement.x, 0) / points.length,
        y: points.reduce((sum, placement) => sum + placement.y, 0) / points.length,
      },
    ];
  });
}

export function irrigationReachMeters(placement: Placement): number {
  return Math.max(0.8, Math.min(2.4, placement.clearance_radius_m * 0.75));
}

export function snapMeters(value: number, step = 0.25): number {
  return Math.round(value / step) * step;
}

export function issueLabel(issue: PlacementIssueCode): string {
  const labels: Record<PlacementIssueCode, string> = {
    boundary: "El radio de seguridad sale del terreno.",
    house: "El radio de seguridad intersecta la casa.",
    spacing: "Se superpone con el radio de otra planta.",
  };
  return labels[issue];
}

function circleIntersectsRectangle(
  circleX: number,
  circleY: number,
  radius: number,
  rectangleX: number,
  rectangleY: number,
  rectangleWidth: number,
  rectangleHeight: number,
): boolean {
  const closestX = Math.max(rectangleX, Math.min(circleX, rectangleX + rectangleWidth));
  const closestY = Math.max(rectangleY, Math.min(circleY, rectangleY + rectangleHeight));
  return Math.hypot(circleX - closestX, circleY - closestY) < radius;
}

function circleIntersectsHouse(
  circleX: number,
  circleY: number,
  radius: number,
  form: PlannerForm,
): boolean {
  if (form.house_shape === "rectangle") {
    return circleIntersectsRectangle(
      circleX,
      circleY,
      radius,
      form.obstacle_x,
      form.obstacle_y,
      form.obstacle_width,
      form.obstacle_height,
    );
  }

  const upperHeight = form.obstacle_height * 0.56;
  const lowerWidth = form.obstacle_width * 0.58;
  return (
    circleIntersectsRectangle(
      circleX,
      circleY,
      radius,
      form.obstacle_x,
      form.obstacle_y,
      form.obstacle_width,
      upperHeight,
    ) ||
    circleIntersectsRectangle(
      circleX,
      circleY,
      radius,
      form.obstacle_x,
      form.obstacle_y + upperHeight,
      lowerWidth,
      form.obstacle_height - upperHeight,
    )
  );
}
