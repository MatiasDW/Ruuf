import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  buildIrrigationZones,
  irrigationReachMeters,
  snapMeters,
  validatePlacements,
} from "./editor";
import { inferCategory, shortLabel, typeColors, waterLabels } from "./model";
import type { FilterMode, HouseFormFields, Placement, PlannerForm } from "./types";

export type GardenSelection = { kind: "house" } | { kind: "plant"; index: number } | null;

interface GardenMapProps {
  form: PlannerForm;
  placements: Placement[];
  filterMode: FilterMode;
  zoom: number;
  selection: GardenSelection;
  onSelectionChange: (selection: GardenSelection) => void;
  onEditorGestureStart: () => void;
  onEditorGestureCommit: () => void;
  onEditorGestureCancel: () => void;
  onHousePreview: (house: HouseFormFields) => void;
  onPlacementChange: (index: number, placement: Placement) => void;
  onPlacementPreview: (index: number, placement: Placement) => void;
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
    };

const UNITS_PER_METER = 100;
const MIN_HOUSE_SIZE = 2;

export function GardenMap({
  form,
  placements,
  filterMode,
  zoom,
  selection,
  onSelectionChange,
  onEditorGestureStart,
  onEditorGestureCommit,
  onEditorGestureCancel,
  onHousePreview,
  onPlacementChange,
  onPlacementPreview,
}: GardenMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
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

    resizeHouse(point.x - dragState.startX, point.y - dragState.startY, dragState);
  }

  function finishDrag(event: ReactPointerEvent<SVGSVGElement>) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
    setDragState(null);
    onEditorGestureCommit();
  }

  function cancelDrag(event: ReactPointerEvent<SVGSVGElement>) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
    setDragState(null);
    onEditorGestureCancel();
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

  function movePlantWithKeyboard(event: KeyboardEvent<SVGGElement>, index: number) {
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
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) {
      return null;
    }
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(matrix.inverse());
  }

  return (
    <div className={dragState ? "garden-editor is-dragging" : "garden-editor"}>
      <svg
        ref={svgRef}
        className="garden-map"
        viewBox={`${viewX} ${viewY} ${visibleWidth} ${visibleHeight}`}
        role="application"
        aria-label={`Editor de jardín de ${form.yard_width} por ${form.yard_height} metros con ${placements.length} plantas`}
        preserveAspectRatio="xMidYMid meet"
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={cancelDrag}
        onPointerDown={() => onSelectionChange(null)}
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
              stroke="#76877b"
              strokeWidth="2"
              opacity="0.14"
            />
            <path
              d="M 50 0 V 100 M 0 50 H 100"
              fill="none"
              stroke="#76877b"
              strokeWidth="1"
              opacity="0.07"
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
          <g className="irrigation-layer" aria-label="Red referencial de riego">
            {placements.map((placement, index) => {
              const reach = irrigationReachMeters(placement) * UNITS_PER_METER;
              return (
                <circle
                  key={`coverage-${placement.plant_id}-${index}`}
                  className={`water-coverage water-${placement.water_need}`}
                  cx={placement.x * UNITS_PER_METER}
                  cy={placement.y * UNITS_PER_METER}
                  r={reach}
                  fill="url(#water-coverage)"
                />
              );
            })}
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
      </svg>

      <div className="map-scale" aria-hidden="true">
        <span>1 m</span>
        <i />
      </div>
      <div className="map-instruction">
        <strong>{filterMode === "water" ? "Riego referencial" : "Edición activa"}</strong>
        <span>
          {filterMode === "water"
            ? `${irrigationZones.length} zonas · tuberías y alcance de emisores`
            : "Arrastra plantas o la casa. Los conflictos aparecen en rojo."}
        </span>
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
