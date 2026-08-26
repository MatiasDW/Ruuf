import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  buildIrrigationZones,
  irrigationReachMeters,
  snapMeters,
  validatePlacements,
} from "./editor";
import { inferCategory, shortLabel, typeColors, waterLabels } from "./model";
import { InteractiveWaterSource } from "./InteractiveWaterSource";
import { IrrigationEditor } from "./IrrigationEditor";
import type {
  FilterMode,
  HouseFormFields,
  IrrigationEditorState,
  LawnZone,
  Placement,
  PlannerForm,
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
  onSelectionChange: (selection: GardenSelection) => void;
  onEditorGestureStart: () => void;
  onEditorGestureCommit: () => void;
  onEditorGestureCancel: () => void;
  onHousePreview: (house: HouseFormFields) => void;
  onPlacementChange: (index: number, placement: Placement) => void;
  onPlacementPreview: (index: number, placement: Placement) => void;
  onSetLawnZones: (zones: LawnZone[]) => void;
  onSetLawnZoneDrawMode: (mode: boolean) => void;
  onSetSelectedLawnZoneId: (id: string | null) => void;
  onIrrigationStateChange?: (state: Partial<IrrigationEditorState>) => void;
  onIrrigationSave?: () => Promise<void>;
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
  onHousePreview,
  onPlacementChange,
  onPlacementPreview,
  onSetLawnZones,
  onSetLawnZoneDrawMode,
  onSetSelectedLawnZoneId,
  onIrrigationStateChange,
  onIrrigationSave,
}: GardenMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [lawnDrawState, setLawnDrawState] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedLawnZoneId) {
        onSetLawnZones(lawnZones.filter((z) => z.id !== selectedLawnZoneId));
        onSetSelectedLawnZoneId(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedLawnZoneId, lawnZones, onSetLawnZones, onSetSelectedLawnZoneId]);
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
  const irrigationZones = buildIrrigationZones(placements);
  const source = {
    x: Math.min(worldWidth, house.x + house.width),
    y: Math.min(worldHeight, house.y + house.height * 0.72),
  };
  const handleSize = 34 / zoom;

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
    setDragState({
      kind: "plant",
      pointerId: event.pointerId,
      index,
      offsetX: point.x - placement.x * UNITS_PER_METER,
      offsetY: point.y - placement.y * UNITS_PER_METER,
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
    setDragState({
      kind: "house",
      pointerId: event.pointerId,
      offsetX: point.x - house.x,
      offsetY: point.y - house.y,
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
                  <circle className="zone-valve" cx={hubX} cy={hubY} r={18 / zoom} />
                  <text className="zone-label" x={hubX + 28 / zoom} y={hubY - 24 / zoom}>
                    Zona {waterLabels[zone.waterNeed].toLowerCase()}
                  </text>
                </g>
              );
            })}
            <g className="water-source" transform={`translate(${source.x} ${source.y})`}>
              <circle r={27 / zoom} />
              <path
                d={`M 0 ${-13 / zoom} C ${10 / zoom} 0 ${12 / zoom} ${6 / zoom} 0 ${13 / zoom} C ${-12 / zoom} ${6 / zoom} ${-10 / zoom} 0 0 ${-13 / zoom} Z`}
              />
            </g>

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
          {form.house_shape === "l_shape" ? (
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
          <text
            x={house.x + house.width / 2}
            y={house.y + house.height / 2 - 8}
            textAnchor="middle"
          >
            CASA
          </text>
          <text
            className="house-dimensions"
            x={house.x + house.width / 2}
            y={house.y + house.height / 2 + 34}
            textAnchor="middle"
          >
            {form.obstacle_width} × {form.obstacle_height} m
          </text>
        </g>

        {selection?.kind === "house" ? (
          <g className="resize-handles" aria-label="Controles para redimensionar la casa">
            {houseHandles(house).map((handle) => (
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
              key={`${placement.plant_id}-${index}-${placement.x}-${placement.y}`}
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
            return (
              <g key={zone.id} className={`lawn-zone ${selected ? "selected" : ""}`}>
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

      <PlantCategoryChips placements={placements} />

      {filterMode === "water" && !irrigationState?.isEditing && (
        <button
          className="edit-irrigation-button"
          onClick={() => onIrrigationStateChange?.({ isEditing: true })}
          data-testid="edit-irrigation-button"
        >
          Editar red
        </button>
      )}

      {irrigationState?.isEditing && onIrrigationStateChange && onIrrigationSave && (
        <IrrigationEditor
          state={irrigationState}
          yardWidth={form.yard_width}
          yardHeight={form.yard_height}
          onStateChange={onIrrigationStateChange}
          onSave={onIrrigationSave}
        />
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
  };
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
    <div className="plant-category-chips" data-testid="plant-category-chips">
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
    </div>
  );
}
