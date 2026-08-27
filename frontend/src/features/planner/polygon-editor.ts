import type { Point } from "./types";
import { distanceToPolygon, polygonSelfIntersects } from "./editor";

export interface PolygonVertex {
  index: number;
}

export interface VertexDragState {
  vertexIndex: number;
  offsetX: number;
  offsetY: number;
}

export function handleVertexDrag(
  polygon: Point[],
  dragState: VertexDragState,
  pointX: number,
  pointY: number,
  snapStep: number = 0.25,
): Point[] | null {
  const x = snapMetersLocal(
    clampLocal(pointX - dragState.offsetX, 0, 100), // Placeholder bounds
    snapStep,
  );
  const y = snapMetersLocal(clampLocal(pointY - dragState.offsetY, 0, 100), snapStep);

  const newPolygon = polygon.map((p, i) => (i === dragState.vertexIndex ? { x, y } : p));

  // Validate no self-intersection
  if (polygonSelfIntersects(newPolygon)) {
    return null;
  }

  return newPolygon;
}

export function insertVertexAtEdge(
  polygon: Point[],
  clickPoint: Point,
  zoomLevel: number,
): Point[] | null {
  const threshold = 0.5 / zoomLevel;
  const dist = distanceToPolygon(clickPoint, polygon);

  if (dist >= threshold) {
    return null;
  }

  // Find closest segment
  let closestSegment = 0;
  let minDist = Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    if (!p1 || !p2) continue;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) continue;

    let t = ((clickPoint.x - p1.x) * dx + (clickPoint.y - p1.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));

    const closestX = p1.x + t * dx;
    const closestY = p1.y + t * dy;
    const d = Math.hypot(clickPoint.x - closestX, clickPoint.y - closestY);

    if (d < minDist) {
      minDist = d;
      closestSegment = i;
    }
  }

  const newVertex: Point = {
    x: snapMetersLocal(clickPoint.x),
    y: snapMetersLocal(clickPoint.y),
  };

  const newPolygon = [
    ...polygon.slice(0, closestSegment + 1),
    newVertex,
    ...polygon.slice(closestSegment + 1),
  ];

  if (polygonSelfIntersects(newPolygon)) {
    return null;
  }

  return newPolygon;
}

export function deleteVertex(polygon: Point[], vertexIndex: number): Point[] | null {
  if (polygon.length <= 3) {
    return null; // Min 3 vertices
  }

  return polygon.filter((_, i) => i !== vertexIndex);
}

export function translatePolygon(polygon: Point[], deltaX: number, deltaY: number): Point[] {
  return polygon.map((p) => ({
    x: p.x + deltaX,
    y: p.y + deltaY,
  }));
}

export function polygonBounds(polygon: Point[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
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

  return { minX, maxX, minY, maxY };
}

function snapMetersLocal(value: number, step = 0.25): number {
  return Math.round(value / step) * step;
}

function clampLocal(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, Math.max(minimum, maximum)));
}
