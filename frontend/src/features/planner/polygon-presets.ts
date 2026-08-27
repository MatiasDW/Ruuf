import type { Point } from "./types";

export function rectanglePolygon(x: number, y: number, width: number, height: number): Point[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

export function lShapePolygon(x: number, y: number, width: number, height: number): Point[] {
  const innerX = x + width * 0.58;
  const innerY = y + height * 0.56;
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: innerY },
    { x: innerX, y: innerY },
    { x: innerX, y: y + height },
    { x, y: y + height },
  ];
}

export function uShapePolygon(x: number, y: number, width: number, height: number): Point[] {
  const innerX1 = x + width * 0.25;
  const innerX2 = x + width * 0.75;
  const innerY = y + height * 0.6;
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x: innerX2, y: y + height },
    { x: innerX2, y: innerY },
    { x: innerX1, y: innerY },
    { x: innerX1, y: y + height },
    { x, y: y + height },
  ];
}

export function tShapePolygon(x: number, y: number, width: number, height: number): Point[] {
  const innerX1 = x + width * 0.35;
  const innerX2 = x + width * 0.65;
  const innerY = y + height * 0.5;
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: innerY },
    { x: innerX2, y: innerY },
    { x: innerX2, y: y + height },
    { x: innerX1, y: y + height },
    { x: innerX1, y: innerY },
    { x, y: innerY },
  ];
}
