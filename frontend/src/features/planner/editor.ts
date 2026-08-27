import type { Placement, PlannerForm, WaterNeed, Point } from "./types";

export type PlacementIssueCode = "boundary" | "house" | "spacing";

export interface PlacementValidation {
  index: number;
  valid: boolean;
  issues: PlacementIssueCode[];
}

export interface IrrigationZone {
  waterNeed: WaterNeed;
  placementIndexes: number[];
  lawnZoneIds: string[];
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

export function buildIrrigationZones(
  placements: Placement[],
  lawnZones?: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    water_need?: WaterNeed;
  }>,
): IrrigationZone[] {
  const grouped = new Map<WaterNeed, { indexes: number[]; lawnZoneIds: string[] }>();

  placements.forEach((placement, index) => {
    const entry = grouped.get(placement.water_need) ?? { indexes: [], lawnZoneIds: [] };
    entry.indexes.push(index);
    grouped.set(placement.water_need, entry);
  });

  if (lawnZones) {
    lawnZones.forEach((zone) => {
      const waterNeed = zone.water_need ?? "medium";
      const entry = grouped.get(waterNeed) ?? { indexes: [], lawnZoneIds: [] };
      entry.lawnZoneIds.push(zone.id);
      grouped.set(waterNeed, entry);
    });
  }

  return (["low", "medium", "high"] as WaterNeed[]).flatMap((waterNeed) => {
    const entry = grouped.get(waterNeed);
    if (!entry || (!entry.indexes.length && !entry.lawnZoneIds.length)) {
      return [];
    }

    const points = entry.indexes.flatMap((index) => {
      const placement = placements[index];
      return placement ? [placement] : [];
    });

    const lawnZoneCenters = entry.lawnZoneIds.flatMap((id) => {
      const zone = lawnZones?.find((z) => z.id === id);
      return zone ? [{ x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 }] : [];
    });

    const allPoints = [...points, ...lawnZoneCenters];
    if (!allPoints.length) return [];

    return [
      {
        waterNeed,
        placementIndexes: entry.indexes,
        lawnZoneIds: entry.lawnZoneIds,
        x: allPoints.reduce((sum, p) => sum + p.x, 0) / allPoints.length,
        y: allPoints.reduce((sum, p) => sum + p.y, 0) / allPoints.length,
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

export function polygonArea(polygon: Point[]): number {
  if (polygon.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    if (!p1 || !p2) continue;
    area += p1.x * p2.y - p2.x * p1.y;
  }

  return Math.abs(area) / 2;
}

export function polygonBounds(polygon: Point[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;

  for (const p of polygon) {
    if (!p) continue;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function issueLabel(issue: PlacementIssueCode): string {
  const labels: Record<PlacementIssueCode, string> = {
    boundary: "El radio de seguridad sale del terreno.",
    house: "El radio de seguridad intersecta la casa.",
    spacing: "Se superpone con el radio de otra planta.",
  };
  return labels[issue];
}

// Polygon geometry helpers — pure functions for validation
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  const { x, y } = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    if (!pi || !pj) continue;
    const xi = pi.x;
    const yi = pi.y;
    const xj = pj.x;
    const yj = pj.y;

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

export function polygonsIntersect(poly1: Point[], poly2: Point[]): boolean {
  if (poly1.length < 3 || poly2.length < 3) return false;
  for (const vertex of poly1) {
    if (pointInPolygon(vertex, poly2)) return true;
  }
  for (const vertex of poly2) {
    if (pointInPolygon(vertex, poly1)) return true;
  }
  return false;
}

/**
 * Punto donde anclar el label de un polígono garantizando que quede DENTRO de la
 * figura: centroide si cae adentro; si la forma es cóncava y el centroide queda
 * afuera, el punto medio del tramo interior más ancho en la altura del centroide.
 */
export function polygonLabelAnchor(polygon: Point[]): Point {
  const n = polygon.length;
  const bboxCenter = {
    x: (Math.min(...polygon.map((p) => p.x)) + Math.max(...polygon.map((p) => p.x))) / 2,
    y: (Math.min(...polygon.map((p) => p.y)) + Math.max(...polygon.map((p) => p.y))) / 2,
  };
  if (n < 3) return bboxCenter;

  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % n]!;
    const cross = a.x * b.y - b.x * a.y;
    area += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  if (Math.abs(area) < 1e-9) return bboxCenter;
  const centroid = { x: cx / (3 * area), y: cy / (3 * area) };
  if (pointInPolygon(centroid, polygon)) return centroid;

  const y = centroid.y;
  const crossings: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % n]!;
    if (a.y > y !== b.y > y) {
      crossings.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
  }
  crossings.sort((left, right) => left - right);
  let best = bboxCenter;
  let bestWidth = -1;
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    const width = crossings[i + 1]! - crossings[i]!;
    if (width > bestWidth) {
      bestWidth = width;
      best = { x: (crossings[i]! + crossings[i + 1]!) / 2, y };
    }
  }
  return best;
}

export function distanceToPolygon(point: Point, polygon: Point[]): number {
  let minDist = Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    if (!p1 || !p2) continue;
    const dist = distanceToLineSegment(point, p1, p2);
    minDist = Math.min(minDist, dist);
  }

  return minDist;
}

function distanceToLineSegment(point: Point, p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return Math.hypot(point.x - p1.x, point.y - p1.y);
  }

  let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = p1.x + t * dx;
  const closestY = p1.y + t * dy;

  return Math.hypot(point.x - closestX, point.y - closestY);
}

export function polygonSelfIntersects(polygon: Point[]): boolean {
  for (let i = 0; i < polygon.length; i++) {
    for (let j = i + 2; j < polygon.length; j++) {
      if (j === polygon.length - 1 && i === 0) continue;
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % polygon.length];
      const p3 = polygon[j];
      const p4 = polygon[(j + 1) % polygon.length];
      if (!p1 || !p2 || !p3 || !p4) continue;
      if (lineSegmentsIntersect(p1, p2, p3, p4)) {
        return true;
      }
    }
  }
  return false;
}

function lineSegmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const ccw = (a: Point, b: Point, c: Point) => {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  };

  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
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
  if (form.house_polygon && form.house_polygon.length >= 3) {
    const point = { x: circleX, y: circleY };
    const pointInside = pointInPolygon(point, form.house_polygon);
    const distToEdge = distanceToPolygon(point, form.house_polygon);
    return pointInside || distToEdge < radius;
  }

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
