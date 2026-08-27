import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  buildIrrigationZones,
  irrigationReachMeters,
  snapMeters,
  validatePlacements,
  distanceToPolygon,
  polygonLabelAnchor,
  polygonsIntersect,
  polygonSelfIntersects,
  pointInPolygon,
} from "./editor";
import { inferCategory, shortLabel, typeColors, waterLabels } from "./model";
import { InteractiveWaterSource } from "./InteractiveWaterSource";
import type {
  FilterMode,
  HouseFormFields,
  IrrigationEditorState,
  LawnZone,
  Placement,
  PlannerForm,
  Point,
  SiteElement,
} from "./types";

export type GardenSelection =
  | { kind: "house" }
  | { kind: "plant"; index: number }
  | { kind: "lawn"; id: string }
  | null;

interface GardenMapProps {
  form: PlannerForm;
  placements: Placement[];
  filterMode: FilterMode;
  zoom: number;
  selection: GardenSelection;
  irrigationState?: IrrigationEditorState;
  lawnZones: LawnZone[];
  lawnZoneDrawMode: boolean;
  selectedLawnZoneId: string | null;
  siteElements: SiteElement[];
  onSelectionChange: (selection: GardenSelection) => void;
  onEditorGestureStart: () => void;
  onEditorGestureCommit: () => void;
  onEditorGestureCancel: () => void;
  onHouseChange: (house: HouseFormFields) => void;
  onHousePreview: (house: HouseFormFields) => void;
  onPlacementChange: (index: number, placement: Placement) => void;
  onPlacementPreview: (index: number, placement: Placement) => void;
  onSetLawnZones: (zones: LawnZone[]) => void;
  onSetLawnZoneDrawMode: (mode: boolean) => void;
  onSetSelectedLawnZoneId: (id: string | null) => void;
  onIrrigationStateChange?: (state: Partial<IrrigationEditorState>) => void;
  onSetSiteElements: (elements: SiteElement[]) => void;
}

type ResizeCorner = "nw" | "ne" | "se" | "sw";
type DragState =
  | { kind: "plant"; pointerId: number; index: number; offsetX: number; offsetY: number }
  | { kind: "house"; pointerId: number; offsetX: number; offsetY: number }
  | {
      kind: "resize";
      pointerId: number;
      corner: ResizeCorner;
      startX: number;
      startY: number;
      house: { x: number; y: number; width: number; height: number };
    }
  | { kind: "lawn-move"; pointerId: number; id: string; offsetX: number; offsetY: number }
  | {
      kind: "lawn-resize";
      pointerId: number;
      id: string;
      corner: ResizeCorner;
      startX: number;
      startY: number;
      zone: { x: number; y: number; width: number; height: number };
    }
  | {
      kind: "polygon-vertex";
      pointerId: number;
      vertexIndex: number;
      offsetX: number;
      offsetY: number;
    };

const UNITS_PER_METER = 100;
const MIN_HOUSE_SIZE = 2;

export function GardenMap({
  form,
  placements,
  filterMode,
  zoom,
  selection,
  irrigationState,
  lawnZones,
  lawnZoneDrawMode,
  selectedLawnZoneId,
  onSelectionChange,
  onEditorGestureStart,
  onEditorGestureCommit,
  onEditorGestureCancel,
  onHouseChange,
  onHousePreview,
  onPlacementChange,
  onPlacementPreview,
  onSetLawnZones,
  onSetLawnZoneDrawMode,
  onSetSelectedLawnZoneId,
  onIrrigationStateChange,
}: GardenMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);
  const [lawnDrawState, setLawnDrawState] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedLawnZoneId) {
          onSetLawnZones(lawnZones.filter((z) => z.id !== selectedLawnZoneId));
          onSetSelectedLawnZoneId(null);
        } else if (
          selectedVertexIndex !== null &&
          form.house_polygon &&
          form.house_polygon.length > 3
        ) {
          const newPolygon = form.house_polygon.filter((_, i) => i !== selectedVertexIndex);
          onHouseChange(houseFieldsFromPolygon(form, newPolygon));
          setSelectedVertexIndex(null);
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedLawnZoneId,
    selectedVertexIndex,
    lawnZones,
    form,
    onSetLawnZones,
    onSetSelectedLawnZoneId,
    onHouseChange,
  ]);
  const worldWidth = form.yard_width * UNITS_PER_METER;
  const worldHeight = form.yard_height * UNITS_PER_METER;
  const visibleWidth = worldWidth / zoom;
  const visibleHeight = worldHeight / zoom;
  const viewX = (worldWidth - visibleWidth) / 2;
  const viewY = (worldHeight - visibleHeight) / 2;
  const house = {
    x: form.obstacle_x * UNITS_PER_METER,
    y: form.obstacle_y * UNITS_PER_METER,
    width: form.obstacle_width * UNITS_PER_METER,
    height: form.obstacle_height * UNITS_PER_METER,
  };
  const validations = validatePlacements(placements, form);
  const validationByIndex = new Map(
    validations.map((validation) => [validation.index, validation]),
  );
  const houseHasConflict = validations.some((validation) => validation.issues.includes("house"));
  const irrigationZones = buildIrrigationZones(placements, lawnZones);
  const source = irrigationState
    ? { x: irrigationState.sourceX * UNITS_PER_METER, y: irrigationState.sourceY * UNITS_PER_METER }
    : {
        x: Math.min(worldWidth, house.x + house.width),
        y: Math.min(worldHeight, house.y + house.height * 0.72),
      };
  const handleSize = 34 / zoom;
  const houseLabelAnchor =
    form.house_polygon && form.house_polygon.length >= 3
      ? (() => {
          const anchor = polygonLabelAnchor(form.house_polygon);
          return { x: anchor.x * UNITS_PER_METER, y: anchor.y * UNITS_PER_METER };
        })()
      : { x: house.x + house.width / 2, y: house.y + house.height / 2 };

  function capturePointer(pointerId: number) {
    svgRef.current?.setPointerCapture(pointerId);
  }

  function startPlantDrag(event: ReactPointerEvent<SVGGElement>, index: number) {
    const placement = placements[index];
    const point = eventPoint(event);
    if (!placement || !point) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    capturePointer(event.pointerId);
    onEditorGestureStart();
    onSelectionChange({ kind: "plant", index });
    // La planta se centra bajo el cursor desde el primer gesto (offset cero).
    setDragState({
      kind: "plant",
      pointerId: event.pointerId,
      index,
      offsetX: 0,
      offsetY: 0,
    });
    onPlacementPreview(index, {
      ...placement,
      x: snapMeters(clamp(point.x / UNITS_PER_METER, 0, form.yard_width)),
      y: snapMeters(clamp(point.y / UNITS_PER_METER, 0, form.yard_height)),
    });
  }

  function startHouseDrag(event: ReactPointerEvent<SVGGElement>) {
    const point = eventPoint(event);
    if (!point) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    capturePointer(event.pointerId);
    onEditorGestureStart();
    onSelectionChange({ kind: "house" });
    const origin =
      form.house_polygon && form.house_polygon.length >= 3
        ? polygonBounds(form.house_polygon)
        : { x: house.x / UNITS_PER_METER, y: house.y / UNITS_PER_METER };
    setDragState({
      kind: "house",
      pointerId: event.pointerId,
      offsetX: point.x - origin.x * UNITS_PER_METER,
      offsetY: point.y - origin.y * UNITS_PER_METER,
    });
  }

  function startLawnMove(event: ReactPointerEvent<SVGRectElement>, zone: LawnZone) {
    const point = eventPoint(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    capturePointer(event.pointerId);
    onSetSelectedLawnZoneId(zone.id);
    onSelectionChange({ kind: "lawn", id: zone.id });
    setDragState({
      kind: "lawn-move",
      pointerId: event.pointerId,
      id: zone.id,
      offsetX: point.x - zone.x * UNITS_PER_METER,
      offsetY: point.y - zone.y * UNITS_PER_METER,
    });
  }

  function startLawnResize(
    event: ReactPointerEvent<SVGCircleElement>,
    zone: LawnZone,
    corner: ResizeCorner,
  ) {
    const point = eventPoint(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    capturePointer(event.pointerId);
    setDragState({
      kind: "lawn-resize",
      pointerId: event.pointerId,
      id: zone.id,
      corner,
      startX: point.x,
      startY: point.y,
      zone: { x: zone.x, y: zone.y, width: zone.width, height: zone.height },
    });
  }

  function resizeLawnZone(
    deltaX: number,
    deltaY: number,
    state: Extract<DragState, { kind: "lawn-resize" }>,
  ) {
    const minSize = 0.5;
    let left = state.zone.x;
    let right = state.zone.x + state.zone.width;
    let top = state.zone.y;
    let bottom = state.zone.y + state.zone.height;

    if (state.corner.includes("w")) {
      left = clamp(state.zone.x + deltaX / UNITS_PER_METER, 0, right - minSize);
    } else {
      right = clamp(
        state.zone.x + state.zone.width + deltaX / UNITS_PER_METER,
        left + minSize,
        form.yard_width,
      );
    }
    if (state.corner.includes("n")) {
      top = clamp(state.zone.y + deltaY / UNITS_PER_METER, 0, bottom - minSize);
    } else {
      bottom = clamp(
        state.zone.y + state.zone.height + deltaY / UNITS_PER_METER,
        top + minSize,
        form.yard_height,
      );
    }

    onSetLawnZones(
      lawnZones.map((z) =>
        z.id === state.id
          ? {
              ...z,
              x: snapMeters(left),
              y: snapMeters(top),
              width: snapMeters(right - left),
              height: snapMeters(bottom - top),
            }
          : z,
      ),
    );
  }

  function startResize(event: ReactPointerEvent<SVGCircleElement>, corner: ResizeCorner) {
    const point = eventPoint(event);
    if (!point) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    capturePointer(event.pointerId);
    onEditorGestureStart();
    onSelectionChange({ kind: "house" });
    setDragState({
      kind: "resize",
      pointerId: event.pointerId,
      corner,
      startX: point.x,
      startY: point.y,
      house,
    });
  }

  function startVertexDrag(event: ReactPointerEvent<SVGCircleElement>, vertexIndex: number) {
    const point = eventPoint(event);
    if (!point) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    capturePointer(event.pointerId);
    onEditorGestureStart();
    onSelectionChange({ kind: "house" });
    setSelectedVertexIndex(vertexIndex);
    setDragState({
      kind: "polygon-vertex",
      pointerId: event.pointerId,
      vertexIndex,
      offsetX: point.x - (form.house_polygon?.[vertexIndex]?.x ?? 0) * UNITS_PER_METER,
      offsetY: point.y - (form.house_polygon?.[vertexIndex]?.y ?? 0) * UNITS_PER_METER,
    });
  }

  function handlePolygonDoubleClick(event: React.MouseEvent<SVGPolygonElement>) {
    if (!form.house_polygon || form.house_polygon.length < 3) return;
    const point = eventPoint(event as unknown as ReactPointerEvent<SVGElement>);
    if (!point) return;

    const clickPoint = { x: point.x / UNITS_PER_METER, y: point.y / UNITS_PER_METER };
    const threshold = 0.5 / zoom;
    const dist = distanceToPolygon(clickPoint, form.house_polygon);

    if (dist < threshold) {
      let closestSegment = 0;
      let minDist = Infinity;
      for (let i = 0; i < form.house_polygon.length; i++) {
        const p1 = form.house_polygon[i];
        const p2 = form.house_polygon[(i + 1) % form.house_polygon.length];
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
        x: snapMeters(clickPoint.x),
        y: snapMeters(clickPoint.y),
      };
      const newPolygon = [
        ...form.house_polygon.slice(0, closestSegment + 1),
        newVertex,
        ...form.house_polygon.slice(closestSegment + 1),
      ];

      if (!polygonSelfIntersects(newPolygon)) {
        onHouseChange(houseFieldsFromPolygon(form, newPolygon));
      }
    }
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    const point = eventPoint(event);
    if (!point) {
      return;
    }
    event.preventDefault();

    if (dragState.kind === "plant") {
      const placement = placements[dragState.index];
      if (!placement) {
        return;
      }
      const x = snapMeters(
        clamp((point.x - dragState.offsetX) / UNITS_PER_METER, 0, form.yard_width),
      );
      const y = snapMeters(
        clamp((point.y - dragState.offsetY) / UNITS_PER_METER, 0, form.yard_height),
      );
      onPlacementPreview(dragState.index, { ...placement, x, y });
      return;
    }

    if (dragState.kind === "house") {
      if (form.house_polygon && form.house_polygon.length >= 3) {
        // La casa poligonal se traslada completa: el label y la validación siguen al bbox.
        const bounds = polygonBounds(form.house_polygon);
        const x = snapMeters(
          clamp((point.x - dragState.offsetX) / UNITS_PER_METER, 0, form.yard_width - bounds.width),
        );
        const y = snapMeters(
          clamp(
            (point.y - dragState.offsetY) / UNITS_PER_METER,
            0,
            form.yard_height - bounds.height,
          ),
        );
        const deltaX = x - bounds.x;
        const deltaY = y - bounds.y;
        const newPolygon = form.house_polygon.map((p) => ({
          x: p.x + deltaX,
          y: p.y + deltaY,
        }));
        onHousePreview(houseFieldsFromPolygon(form, newPolygon));
        return;
      }
      const x = snapMeters(
        clamp(
          (point.x - dragState.offsetX) / UNITS_PER_METER,
          0,
          form.yard_width - form.obstacle_width,
        ),
      );
      const y = snapMeters(
        clamp(
          (point.y - dragState.offsetY) / UNITS_PER_METER,
          0,
          form.yard_height - form.obstacle_height,
        ),
      );
      onHousePreview({
        ...pickHouse(form),
        obstacle_x: x,
        obstacle_y: y,
      });
      return;
    }

    if (dragState.kind === "lawn-move") {
      const zone = lawnZones.find((z) => z.id === dragState.id);
      if (!zone) return;
      const x = snapMeters(
        clamp((point.x - dragState.offsetX) / UNITS_PER_METER, 0, form.yard_width - zone.width),
      );
      const y = snapMeters(
        clamp((point.y - dragState.offsetY) / UNITS_PER_METER, 0, form.yard_height - zone.height),
      );
      onSetLawnZones(lawnZones.map((z) => (z.id === dragState.id ? { ...z, x, y } : z)));
      return;
    }

    if (dragState.kind === "lawn-resize") {
      resizeLawnZone(point.x - dragState.startX, point.y - dragState.startY, dragState);
      return;
    }

    if (dragState.kind === "resize") {
      resizeHouse(point.x - dragState.startX, point.y - dragState.startY, dragState);
      return;
    }

    if (dragState.kind === "polygon-vertex") {
      if (!form.house_polygon) return;
      const x = snapMeters(
        clamp((point.x - dragState.offsetX) / UNITS_PER_METER, 0, form.yard_width),
      );
      const y = snapMeters(
        clamp((point.y - dragState.offsetY) / UNITS_PER_METER, 0, form.yard_height),
      );
      const newPolygon = form.house_polygon.map((p, i) =>
        i === dragState.vertexIndex ? { x, y } : p,
      );
      if (!polygonSelfIntersects(newPolygon)) {
        onHousePreview(houseFieldsFromPolygon(form, newPolygon));
      }
    }
  }

  function finishDrag(event: ReactPointerEvent<SVGSVGElement>) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
    const isLawnOp = dragState.kind === "lawn-move" || dragState.kind === "lawn-resize";
    setDragState(null);
    if (!isLawnOp) onEditorGestureCommit();
  }

  function cancelDrag(event: ReactPointerEvent<SVGSVGElement>) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
    const isLawnOp = dragState.kind === "lawn-move" || dragState.kind === "lawn-resize";
    setDragState(null);
    if (!isLawnOp) onEditorGestureCancel();
  }

  function resizeHouse(
    deltaX: number,
    deltaY: number,
    state: Extract<DragState, { kind: "resize" }>,
  ) {
    let left = state.house.x;
    let right = state.house.x + state.house.width;
    let top = state.house.y;
    let bottom = state.house.y + state.house.height;
    const minSize = MIN_HOUSE_SIZE * UNITS_PER_METER;

    if (state.corner.includes("w")) {
      left = clamp(state.house.x + deltaX, 0, right - minSize);
    } else {
      right = clamp(state.house.x + state.house.width + deltaX, left + minSize, worldWidth);
    }
    if (state.corner.includes("n")) {
      top = clamp(state.house.y + deltaY, 0, bottom - minSize);
    } else {
      bottom = clamp(state.house.y + state.house.height + deltaY, top + minSize, worldHeight);
    }

    onHousePreview({
      ...pickHouse(form),
      obstacle_x: snapMeters(left / UNITS_PER_METER),
      obstacle_y: snapMeters(top / UNITS_PER_METER),
      obstacle_width: snapMeters((right - left) / UNITS_PER_METER),
      obstacle_height: snapMeters((bottom - top) / UNITS_PER_METER),
    });
  }

  function movePlantWithKeyboard(event: ReactKeyboardEvent<SVGGElement>, index: number) {
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-0.25, 0],
      ArrowRight: [0.25, 0],
      ArrowUp: [0, -0.25],
      ArrowDown: [0, 0.25],
    };
    const delta = deltas[event.key];
    const placement = placements[index];
    if (!delta || !placement) {
      return;
    }
    event.preventDefault();
    onSelectionChange({ kind: "plant", index });
    onPlacementChange(index, {
      ...placement,
      x: snapMeters(clamp(placement.x + delta[0], 0, form.yard_width)),
      y: snapMeters(clamp(placement.y + delta[1], 0, form.yard_height)),
    });
  }

  function eventPoint(event: ReactPointerEvent<SVGElement>) {
    const svg = svgRef.current;
    if (!svg) return null;

    const matrix = svg.getScreenCTM();
    if (!matrix) return null;

    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(matrix.inverse());
  }

  function handleSvgPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (lawnZoneDrawMode && event.button === 0) {
      const point = eventPoint(event);
      if (point) {
        setLawnDrawState({
          startX: point.x,
          startY: point.y,
          currentX: point.x,
          currentY: point.y,
        });
        event.preventDefault();
      }
    } else {
      onSelectionChange(null);
    }
  }

  function handleSvgPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    handlePointerMove(event);
    if (lawnDrawState) {
      const point = eventPoint(event);
      if (point) {
        setLawnDrawState((prev) =>
          prev ? { ...prev, currentX: point.x, currentY: point.y } : null,
        );
      }
    }
  }

  function handleSvgPointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    if (lawnDrawState) {
      const point = eventPoint(event);
      if (point) {
        const x1 = Math.min(lawnDrawState.startX, point.x) / UNITS_PER_METER;
        const y1 = Math.min(lawnDrawState.startY, point.y) / UNITS_PER_METER;
        const x2 = Math.max(lawnDrawState.startX, point.x) / UNITS_PER_METER;
        const y2 = Math.max(lawnDrawState.startY, point.y) / UNITS_PER_METER;

        if (x2 - x1 > 0.5 && y2 - y1 > 0.5) {
          const newZone: LawnZone = {
            id: `lawn-${Date.now()}`,
            x: x1,
            y: y1,
            width: x2 - x1,
            height: y2 - y1,
            water_need: "medium",
            liters_per_m2_week: 0,
          };
          onSetLawnZones([...lawnZones, newZone]);
          onSetLawnZoneDrawMode(false);
        }
      }
      setLawnDrawState(null);
    }
    finishDrag(event);
  }

  return (
    <div
      className={[
        "garden-editor",
        dragState ? "is-dragging" : "",
        lawnZoneDrawMode ? "lawn-draw-mode" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <svg
        ref={svgRef}
        className="garden-map"
        viewBox={`${viewX} ${viewY} ${visibleWidth} ${visibleHeight}`}
        role="application"
        aria-label={`Editor de jardín de ${form.yard_width} por ${form.yard_height} metros con ${placements.length} plantas`}
        preserveAspectRatio="xMidYMid meet"
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
        onPointerCancel={cancelDrag}
        onPointerDown={handleSvgPointerDown}
      >
        <defs>
          <linearGradient id="yard-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f1f5ed" />
            <stop offset="1" stopColor="#dfe9d9" />
          </linearGradient>
          <radialGradient id="water-coverage" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#5aa7bb" stopOpacity="0.24" />
            <stop offset="0.72" stopColor="#5aa7bb" stopOpacity="0.1" />
            <stop offset="1" stopColor="#5aa7bb" stopOpacity="0" />
          </radialGradient>
          <pattern id="metric-grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <path
              d="M 100 0 L 0 0 0 100"
              fill="none"
              stroke="#8a9c8f"
              strokeWidth="2.5"
              opacity="0.25"
            />
            <path
              d="M 50 0 V 100 M 0 50 H 100"
              fill="none"
              stroke="#8a9c8f"
              strokeWidth="1.2"
              opacity="0.15"
            />
          </pattern>
          <filter id="map-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow
              dx="0"
              dy="12"
              stdDeviation="15"
              floodColor="#163422"
              floodOpacity="0.16"
            />
          </filter>
        </defs>

        <rect width={worldWidth} height={worldHeight} rx="28" fill="url(#yard-fill)" />
        <rect width={worldWidth} height={worldHeight} rx="28" fill="url(#metric-grid)" />
        <rect
          x="6"
          y="6"
          width={worldWidth - 12}
          height={worldHeight - 12}
          rx="24"
          fill="none"
          stroke="#687a6f"
          strokeWidth="12"
          opacity="0.56"
        />

        <g className="dimension-layer" aria-hidden="true">
          <text x={worldWidth / 2} y="54" textAnchor="middle">
            {form.yard_width} m
          </text>
          <text
            x={worldWidth - 42}
            y={worldHeight / 2}
            textAnchor="middle"
            transform={`rotate(90 ${worldWidth - 42} ${worldHeight / 2})`}
          >
            {form.yard_height} m
          </text>
          <g transform={`translate(${worldWidth - 120} 110)`} className="north-arrow">
            <path d="M 0 42 L 22 0 L 44 42 L 22 31 Z" />
            <text x="22" y="70" textAnchor="middle">
              N
            </text>
          </g>
        </g>

        {filterMode === "water" ? (
          <g className="irrigation-layer" aria-label="Red de riego">
            {irrigationZones.map((zone) => {
              const hubX = zone.x * UNITS_PER_METER;
              const hubY = zone.y * UNITS_PER_METER;
              return (
                <g key={zone.waterNeed} className={`irrigation-zone zone-${zone.waterNeed}`}>
                  <path
                    className="pipe-main pipe-flow"
                    d={`M ${source.x} ${source.y} H ${hubX} V ${hubY}`}
                  />
                  {zone.placementIndexes.map((index) => {
                    const placement = placements[index];
                    return placement ? (
                      <path
                        key={`branch-${placement.plant_id}-${index}`}
                        className="pipe-branch pipe-flow"
                        d={`M ${hubX} ${hubY} L ${placement.x * UNITS_PER_METER} ${placement.y * UNITS_PER_METER}`}
                      />
                    ) : null;
                  })}
                  {zone.lawnZoneIds.map((lawnZoneId) => {
                    const lawnZone = lawnZones.find((z) => z.id === lawnZoneId);
                    if (!lawnZone) return null;
                    const lawnX = (lawnZone.x + lawnZone.width / 2) * UNITS_PER_METER;
                    const lawnY = (lawnZone.y + lawnZone.height / 2) * UNITS_PER_METER;
                    return (
                      <g key={`lawn-${lawnZoneId}`}>
                        <path
                          className="pipe-branch pipe-flow"
                          d={`M ${hubX} ${hubY} L ${lawnX} ${lawnY}`}
                        />
                        <g className="lawn-irrigation-coverage">
                          {lawnZone.polygon && lawnZone.polygon.length >= 3 ? (
                            <>
                              <polygon
                                points={lawnZone.polygon
                                  .map((p) => [p.x * UNITS_PER_METER, p.y * UNITS_PER_METER].join(","))
                                  .join(" ")}
                                className="sprinkler-coverage"
                                fill="rgba(90, 167, 187, 0.15)"
                              />
                              {renderSprinklerHeadsInPolygon(lawnZone.polygon, zoom)}
                            </>
                          ) : (
                            <>
                              <rect
                                x={lawnZone.x * UNITS_PER_METER}
                                y={lawnZone.y * UNITS_PER_METER}
                                width={lawnZone.width * UNITS_PER_METER}
                                height={lawnZone.height * UNITS_PER_METER}
                                className="sprinkler-coverage"
                                fill="rgba(90, 167, 187, 0.15)"
                              />
                              {renderSprinklerHeads(
                                lawnZone.x * UNITS_PER_METER,
                                lawnZone.y * UNITS_PER_METER,
                                lawnZone.width * UNITS_PER_METER,
                                lawnZone.height * UNITS_PER_METER,
                                zoom,
                              )}
                            </>
                          )}
                        </g>
                      </g>
                    );
                  })}
                  <circle className="zone-valve" cx={hubX} cy={hubY} r={18 / zoom} />
                  <text className="zone-label" x={hubX + 28 / zoom} y={hubY - 24 / zoom}>
                    Zona {waterLabels[zone.waterNeed].toLowerCase()}
                  </text>
                </g>
              );
            })}
            {!irrigationState?.isEditing ? (
              <g className="water-source" transform={`translate(${source.x} ${source.y})`}>
                <circle r={27 / zoom} />
                <path
                  d={`M 0 ${-13 / zoom} C ${10 / zoom} 0 ${12 / zoom} ${6 / zoom} 0 ${13 / zoom} C ${-12 / zoom} ${6 / zoom} ${-10 / zoom} 0 0 ${-13 / zoom} Z`}
                />
              </g>
            ) : null}

            {irrigationState?.isEditing && onIrrigationStateChange ? (
              <InteractiveWaterSource
                sourceX={irrigationState.sourceX}
                sourceY={irrigationState.sourceY}
                yardWidth={form.yard_width}
                yardHeight={form.yard_height}
                zoom={zoom}
                pipeRoute={irrigationState.pipeRoute}
                onSourceMove={(x, y) => onIrrigationStateChange({ sourceX: x, sourceY: y })}
                onRoutePointMove={(index, x, y) => {
                  const newRoute = [...irrigationState.pipeRoute];
                  newRoute[index] = { x, y };
                  onIrrigationStateChange({ pipeRoute: newRoute });
                }}
                onRoutePointAdd={(x, y) => {
                  onIrrigationStateChange({
                    pipeRoute: [...irrigationState.pipeRoute, { x, y }],
                  });
                }}
                onRoutePointSelect={() => {}}
              />
            ) : null}
          </g>
        ) : null}

        <g
          className={`house-footprint ${selection?.kind === "house" ? "selected" : ""} ${houseHasConflict ? "has-conflict" : ""}`}
          role="button"
          tabIndex={0}
          aria-label="Casa. Arrastra para moverla y usa los controles de esquina para cambiar su tamaño."
          onPointerDown={startHouseDrag}
          onFocus={() => onSelectionChange({ kind: "house" })}
          data-testid="house-footprint"
        >
          {form.house_polygon && form.house_polygon.length >= 3 ? (
            <polygon
              points={form.house_polygon
                .map((p) => [p.x * UNITS_PER_METER, p.y * UNITS_PER_METER].join(","))
                .join(" ")}
              filter="url(#map-shadow)"
              onDoubleClick={handlePolygonDoubleClick}
            />
          ) : form.house_shape === "l_shape" ? (
            <polygon points={housePolygon(house)} filter="url(#map-shadow)" />
          ) : (
            <rect
              x={house.x}
              y={house.y}
              width={house.width}
              height={house.height}
              rx="18"
              filter="url(#map-shadow)"
            />
          )}
          <text x={houseLabelAnchor.x} y={houseLabelAnchor.y - 8} textAnchor="middle">
            CASA
          </text>
          <text
            className="house-dimensions"
            x={houseLabelAnchor.x}
            y={houseLabelAnchor.y + 34}
            textAnchor="middle"
          >
            {form.obstacle_width} × {form.obstacle_height} m
          </text>
        </g>

        {selection?.kind === "house" ? (
          <g className="resize-handles" aria-label="Controles para redimensionar la casa">
            {form.house_polygon && form.house_polygon.length >= 3
              ? form.house_polygon.map((vertex, index) => (
                  <circle
                    key={`vertex-${index}`}
                    cx={vertex.x * UNITS_PER_METER}
                    cy={vertex.y * UNITS_PER_METER}
                    r={handleSize}
                    className={selectedVertexIndex === index ? "vertex selected" : "vertex"}
                    onPointerDown={(event) => startVertexDrag(event, index)}
                    onClick={() => setSelectedVertexIndex(index)}
                    data-testid={`polygon-vertex-${index}`}
                  />
                ))
              : houseHandles(house).map((handle) => (
                  <circle
                    key={handle.corner}
                    cx={handle.x}
                    cy={handle.y}
                    r={handleSize}
                    onPointerDown={(event) => startResize(event, handle.corner)}
                    data-testid={`house-resize-${handle.corner}`}
                  />
                ))}
          </g>
        ) : null}

        {placements.map((placement, index) => {
          const category = inferCategory(placement.name);
          const color = typeColors[category];
          const radius = placement.clearance_radius_m * UNITS_PER_METER;
          const markerRadius = Math.max(34 / zoom, Math.min(radius * 0.32, 70 / zoom));
          const validation = validationByIndex.get(index);
          const invalid = validation ? !validation.valid : false;
          const selected = selection?.kind === "plant" && selection.index === index;

          return (
            <g
              key={`${placement.plant_id}-${index}`}
              className={`plant-marker ${selected ? "selected" : ""} ${invalid ? "has-conflict" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`${placement.name}, riego ${waterLabels[placement.water_need].toLowerCase()}. Arrastra para mover.`}
              onPointerDown={(event) => startPlantDrag(event, index)}
              onFocus={() => onSelectionChange({ kind: "plant", index })}
              onKeyDown={(event) => movePlantWithKeyboard(event, index)}
              data-testid={`plant-marker-${index}`}
            >
              {filterMode === "water" ? (
                <circle
                  className={`water-coverage water-${placement.water_need}`}
                  cx={placement.x * UNITS_PER_METER}
                  cy={placement.y * UNITS_PER_METER}
                  r={irrigationReachMeters(placement) * UNITS_PER_METER}
                  fill="url(#water-coverage)"
                  pointerEvents="none"
                />
              ) : null}
              {filterMode === "type" || invalid || selected ? (
                <circle
                  className="clearance-ring"
                  cx={placement.x * UNITS_PER_METER}
                  cy={placement.y * UNITS_PER_METER}
                  r={radius}
                  fill={invalid ? "#d9483b" : color}
                  stroke={invalid ? "#b42318" : color}
                />
              ) : null}
              <circle
                className="plant-core"
                cx={placement.x * UNITS_PER_METER}
                cy={placement.y * UNITS_PER_METER}
                r={markerRadius}
                fill={color}
                stroke={invalid ? "#fff3f0" : "#f8faf8"}
                filter="url(#map-shadow)"
              />
              <text
                x={placement.x * UNITS_PER_METER}
                y={placement.y * UNITS_PER_METER + 13 / zoom}
                textAnchor="middle"
                className="plant-label"
              >
                {shortLabel(placement.name)}
              </text>
              {filterMode === "water" ? (
                <circle
                  className="sprinkler-head"
                  cx={placement.x * UNITS_PER_METER + markerRadius * 0.72}
                  cy={placement.y * UNITS_PER_METER - markerRadius * 0.72}
                  r={12 / zoom}
                />
              ) : null}
            </g>
          );
        })}

        <g className="lawn-zones-layer">
          {lawnZones.map((zone) => {
            const selected = selectedLawnZoneId === zone.id;
            const zonePoly = zone.polygon ?? [
              { x: zone.x, y: zone.y },
              { x: zone.x + zone.width, y: zone.y },
              { x: zone.x + zone.width, y: zone.y + zone.height },
              { x: zone.x, y: zone.y + zone.height },
            ];
            const housePoly = form.house_polygon ?? [
              { x: house.x / UNITS_PER_METER, y: house.y / UNITS_PER_METER },
              { x: (house.x + house.width) / UNITS_PER_METER, y: house.y / UNITS_PER_METER },
              { x: (house.x + house.width) / UNITS_PER_METER, y: (house.y + house.height) / UNITS_PER_METER },
              { x: house.x / UNITS_PER_METER, y: (house.y + house.height) / UNITS_PER_METER },
            ];
            const conflict = polygonsIntersect(zonePoly, housePoly);
            return (
              <g key={zone.id} className={`lawn-zone ${selected ? "selected" : ""} ${conflict ? "has-conflict" : ""}`}>
                <rect
                  x={zone.x * UNITS_PER_METER}
                  y={zone.y * UNITS_PER_METER}
                  width={zone.width * UNITS_PER_METER}
                  height={zone.height * UNITS_PER_METER}
                  className="lawn-zone-rect"
                  role="button"
                  tabIndex={0}
                  aria-label={`Zona de césped ${(zone.width * zone.height).toFixed(1)} m²`}
                  onPointerDown={(e) => startLawnMove(e, zone)}
                  onKeyDown={(e) => {
                    if (e.key === "Delete" || e.key === "Backspace") {
                      onSetLawnZones(lawnZones.filter((z) => z.id !== zone.id));
                      onSetSelectedLawnZoneId(null);
                    }
                  }}
                />
                <text
                  x={(zone.x + zone.width / 2) * UNITS_PER_METER}
                  y={(zone.y + zone.height / 2) * UNITS_PER_METER}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="lawn-label"
                  pointerEvents="none"
                >
                  Césped
                </text>
              </g>
            );
          })}
        </g>

        {selection?.kind === "lawn" &&
          (() => {
            const zone = lawnZones.find((z) => z.id === selection.id);
            if (!zone) return null;
            return (
              <g
                className="resize-handles lawn-resize-handles"
                aria-label="Controles para redimensionar la zona de césped"
              >
                {lawnZoneHandles(zone).map((handle) => (
                  <circle
                    key={handle.corner}
                    cx={handle.x * UNITS_PER_METER}
                    cy={handle.y * UNITS_PER_METER}
                    r={handleSize}
                    onPointerDown={(e) => startLawnResize(e, zone, handle.corner)}
                    data-testid={`lawn-resize-${handle.corner}`}
                  />
                ))}
              </g>
            );
          })()}

        {lawnDrawState && (
          <rect
            x={Math.min(lawnDrawState.startX, lawnDrawState.currentX)}
            y={Math.min(lawnDrawState.startY, lawnDrawState.currentY)}
            width={Math.abs(lawnDrawState.currentX - lawnDrawState.startX)}
            height={Math.abs(lawnDrawState.currentY - lawnDrawState.startY)}
            className="lawn-zone-preview"
            pointerEvents="none"
          />
        )}
      </svg>

      {filterMode === "type" ? (
        <PlantCategoryChips placements={placements} />
      ) : (
        <CollapsibleOverlay
          className="irrigation-legend-overlay"
          storageKey="ruuf.overlay.legend"
          label="Leyenda"
          testId="irrigation-legend"
        >
          <span>
            <i className="pipe-swatch main" />
            Tubería principal
          </span>
          <span>
            <i className="pipe-swatch branch" />
            Ramales
          </span>
          <span>
            <i className="coverage-swatch" />
            Alcance estimado
          </span>
          <span>
            <i className="sprinkler-swatch" />
            Aspersión césped
          </span>
        </CollapsibleOverlay>
      )}

      {filterMode === "water" && !irrigationState?.isEditing && (
        <button
          className="edit-irrigation-button"
          onClick={() => onIrrigationStateChange?.({ isEditing: true })}
          data-testid="edit-irrigation-button"
        >
          Editar red
        </button>
      )}

      <div className="map-scale" aria-hidden="true">
        <div className="scale-bar">
          <div className="scale-mark" />
          <div className="scale-tick" />
          <div className="scale-tick" />
          <div className="scale-tick" />
          <div className="scale-mark" />
        </div>
        <span>1 m</span>
      </div>
    </div>
  );
}

function pickHouse(form: PlannerForm): HouseFormFields {
  return {
    obstacle_width: form.obstacle_width,
    obstacle_height: form.obstacle_height,
    obstacle_x: form.obstacle_x,
    obstacle_y: form.obstacle_y,
    house_shape: form.house_shape,
    house_polygon: form.house_polygon,
  };
}

function polygonBounds(points: Point[]): { x: number; y: number; width: number; height: number } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}

/**
 * Toda mutación del polígono pasa por aquí: obstacle_* se mantiene como el bbox del
 * polígono para que el label CASA, el inspector y las validaciones sigan a la forma real.
 */
function houseFieldsFromPolygon(form: PlannerForm, polygon: Point[]): HouseFormFields {
  const bounds = polygonBounds(polygon);
  return {
    ...pickHouse(form),
    house_polygon: polygon,
    obstacle_x: round2(bounds.x),
    obstacle_y: round2(bounds.y),
    obstacle_width: round2(bounds.width),
    obstacle_height: round2(bounds.height),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function housePolygon(house: { x: number; y: number; width: number; height: number }): string {
  const innerX = house.x + house.width * 0.58;
  const innerY = house.y + house.height * 0.56;
  return [
    [house.x, house.y],
    [house.x + house.width, house.y],
    [house.x + house.width, innerY],
    [innerX, innerY],
    [innerX, house.y + house.height],
    [house.x, house.y + house.height],
  ]
    .map((point) => point.join(","))
    .join(" ");
}

function houseHandles(house: { x: number; y: number; width: number; height: number }) {
  return [
    { corner: "nw" as const, x: house.x, y: house.y },
    { corner: "ne" as const, x: house.x + house.width, y: house.y },
    { corner: "se" as const, x: house.x + house.width, y: house.y + house.height },
    { corner: "sw" as const, x: house.x, y: house.y + house.height },
  ];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, Math.max(minimum, maximum)));
}

function lawnZoneHandles(zone: LawnZone) {
  return [
    { corner: "nw" as const, x: zone.x, y: zone.y },
    { corner: "ne" as const, x: zone.x + zone.width, y: zone.y },
    { corner: "se" as const, x: zone.x + zone.width, y: zone.y + zone.height },
    { corner: "sw" as const, x: zone.x, y: zone.y + zone.height },
  ];
}

function renderSprinklerHeads(
  x: number,
  y: number,
  width: number,
  height: number,
  zoom: number,
): React.ReactNode[] {
  const spacing = 300; // ~3 metros en unidades (100 unidades = 1 metro → 300 = 3m)
  const headRadius = 8 / zoom;
  const heads: React.ReactNode[] = [];

  for (let sx = x + spacing / 2; sx < x + width; sx += spacing) {
    for (let sy = y + spacing / 2; sy < y + height; sy += spacing) {
      heads.push(
        <circle
          key={`head-${sx}-${sy}`}
          cx={sx}
          cy={sy}
          r={headRadius}
          className="sprinkler-head"
        />,
      );
    }
  }

  return heads;
}

function renderSprinklerHeadsInPolygon(polygon: Point[], zoom: number): React.ReactNode[] {
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

  const spacing = 300; // ~3 metros en unidades
  const headRadius = 8 / zoom;
  const heads: React.ReactNode[] = [];

  for (let sx = minX * UNITS_PER_METER + spacing / 2; sx < maxX * UNITS_PER_METER; sx += spacing) {
    for (let sy = minY * UNITS_PER_METER + spacing / 2; sy < maxY * UNITS_PER_METER; sy += spacing) {
      // Convertir a metros para pointInPolygon
      const point: Point = { x: sx / UNITS_PER_METER, y: sy / UNITS_PER_METER };
      if (pointInPolygon(point, polygon)) {
        heads.push(
          <circle
            key={`head-${sx}-${sy}`}
            cx={sx}
            cy={sy}
            r={headRadius}
            className="sprinkler-head"
          />,
        );
      }
    }
  }

  return heads;
}

interface CategoryCount {
  tree: number;
  shrub: number;
  flower: number;
  grass: number;
}

function countPlantsByCategory(placements: Placement[]): CategoryCount {
  const counts: CategoryCount = { tree: 0, shrub: 0, flower: 0, grass: 0 };
  for (const placement of placements) {
    const category = inferCategory(placement.name);
    if (category === "tree") counts.tree += 1;
    else if (category === "shrub") counts.shrub += 1;
    else if (category === "flower") counts.flower += 1;
    else if (category === "grass") counts.grass += 1;
  }
  return counts;
}

interface PlantCategoryChipsProps {
  placements: Placement[];
}

function PlantCategoryChips({ placements }: PlantCategoryChipsProps) {
  const counts = countPlantsByCategory(placements);

  return (
    <CollapsibleOverlay
      className="plant-category-chips"
      storageKey="ruuf.overlay.chips"
      label="Capas"
      testId="plant-category-chips"
    >
      <div className="chip chip-tree">
        <span className="chip-icon">🌲</span>
        <span className="chip-label">Árbol</span>
        <span className="chip-count">{counts.tree}</span>
      </div>
      <div className="chip chip-shrub">
        <span className="chip-icon">🌳</span>
        <span className="chip-label">Arbusto</span>
        <span className="chip-count">{counts.shrub}</span>
      </div>
      <div className="chip chip-flower">
        <span className="chip-icon">🌸</span>
        <span className="chip-label">Flor</span>
        <span className="chip-count">{counts.flower}</span>
      </div>
      <div className="chip chip-grass">
        <span className="chip-icon">🌾</span>
        <span className="chip-label">Césped</span>
        <span className="chip-count">{counts.grass}</span>
      </div>
    </CollapsibleOverlay>
  );
}

interface CollapsibleOverlayProps {
  className: string;
  storageKey: string;
  label: string;
  testId: string;
  children: ReactNode;
}

/** Panel glass flotante que recuerda su estado abierto/cerrado entre sesiones. */
function CollapsibleOverlay({
  className,
  storageKey,
  label,
  testId,
  children,
}: CollapsibleOverlayProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  function toggle() {
    setCollapsed((current) => {
      try {
        localStorage.setItem(storageKey, current ? "0" : "1");
      } catch {
        // localStorage puede fallar en modo privado; el toggle sigue funcionando en memoria.
      }
      return !current;
    });
  }

  return (
    <div className={collapsed ? `${className} collapsed` : className} data-testid={testId}>
      <button
        type="button"
        className="overlay-toggle"
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? `Mostrar ${label.toLowerCase()}` : `Ocultar ${label.toLowerCase()}`}
      >
        {collapsed ? `${label} ⌃` : "⌄"}
      </button>
      {children}
    </div>
  );
}
