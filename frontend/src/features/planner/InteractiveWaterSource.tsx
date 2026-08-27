import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

interface InteractiveWaterSourceProps {
  sourceX: number;
  sourceY: number;
  yardWidth: number;
  yardHeight: number;
  zoom: number;
  pipeRoute: Array<{ x: number; y: number }>;
  onSourceMove: (x: number, y: number) => void;
  onRoutePointMove: (index: number, x: number, y: number) => void;
  onRoutePointAdd: (x: number, y: number) => void;
  onRoutePointSelect: (index: number | null) => void;
}

const UNITS_PER_METER = 100;
const GRID_SNAP = 0.25;

function snapMeters(value: number): number {
  return Math.round(value / GRID_SNAP) * GRID_SNAP;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function InteractiveWaterSource({
  sourceX,
  sourceY,
  yardWidth,
  yardHeight,
  zoom,
  pipeRoute,
  onSourceMove,
  onRoutePointMove,
  onRoutePointAdd,
  onRoutePointSelect,
}: InteractiveWaterSourceProps) {
  const svgRef = useRef<SVGGElement>(null);
  const [dragState, setDragState] = useState<
    | { kind: "source"; offsetX: number; offsetY: number }
    | { kind: "route-point"; index: number; offsetX: number; offsetY: number }
    | null
  >(null);

  function getEventPoint(event: ReactPointerEvent<SVGElement>) {
    let target: Element | null = event.currentTarget;
    while (target && target.tagName.toLowerCase() !== "svg") {
      target = target.parentElement;
    }
    const svg = target as unknown as SVGSVGElement | null;
    if (!svg) return null;

    const matrix = svg.getScreenCTM?.();
    if (!matrix) return null;

    const point = svg.createSVGPoint?.();
    if (!point) return null;

    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(matrix.inverse());
  }

  function handleSourcePointerDown(event: ReactPointerEvent<SVGCircleElement>) {
    const point = getEventPoint(event);
    if (!point) return;

    event.preventDefault();
    event.stopPropagation();

    setDragState({
      kind: "source",
      offsetX: point.x - sourceX * UNITS_PER_METER,
      offsetY: point.y - sourceY * UNITS_PER_METER,
    });
  }

  function handleRoutePointPointerDown(event: ReactPointerEvent<SVGCircleElement>, index: number) {
    const point = getEventPoint(event);
    if (!point) return;

    event.preventDefault();
    event.stopPropagation();
    onRoutePointSelect(index);

    const routePoint = pipeRoute[index];
    if (!routePoint) return;

    setDragState({
      kind: "route-point",
      index,
      offsetX: point.x - routePoint.x * UNITS_PER_METER,
      offsetY: point.y - routePoint.y * UNITS_PER_METER,
    });
  }

  function handlePointerMove(event: ReactPointerEvent<SVGGElement>) {
    if (!dragState) return;

    const point = getEventPoint(event);
    if (!point) return;

    event.preventDefault();

    if (dragState.kind === "source") {
      const x = snapMeters(clamp((point.x - dragState.offsetX) / UNITS_PER_METER, 0, yardWidth));
      const y = snapMeters(clamp((point.y - dragState.offsetY) / UNITS_PER_METER, 0, yardHeight));
      onSourceMove(x, y);
    } else if (dragState.kind === "route-point") {
      const x = snapMeters(clamp((point.x - dragState.offsetX) / UNITS_PER_METER, 0, yardWidth));
      const y = snapMeters(clamp((point.y - dragState.offsetY) / UNITS_PER_METER, 0, yardHeight));
      onRoutePointMove(dragState.index, x, y);
    }
  }

  function handlePointerUp() {
    setDragState(null);
  }

  function handleMapClick(event: ReactPointerEvent<SVGGElement>) {
    if (event.target !== event.currentTarget) return;

    const point = getEventPoint(event);
    if (!point) return;

    const x = snapMeters(clamp(point.x / UNITS_PER_METER, 0, yardWidth));
    const y = snapMeters(clamp(point.y / UNITS_PER_METER, 0, yardHeight));
    onRoutePointAdd(x, y);
  }

  const handleRadius = 20 / zoom;

  return (
    <g
      ref={svgRef}
      className="interactive-water-source"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleMapClick}
    >
      {/* Pipe route visualization */}
      {pipeRoute.length > 0 && (
        <>
          {pipeRoute.map((point, index) => (
            <circle
              key={`route-point-${index}`}
              className="route-point"
              cx={point.x * UNITS_PER_METER}
              cy={point.y * UNITS_PER_METER}
              r={handleRadius}
              onPointerDown={(e) => handleRoutePointPointerDown(e, index)}
              data-testid={`route-point-${index}`}
            />
          ))}

          {/* Route line */}
          <polyline
            className="pipe-route-line"
            points={[
              `${sourceX * UNITS_PER_METER},${sourceY * UNITS_PER_METER}`,
              ...pipeRoute.map((p) => `${p.x * UNITS_PER_METER},${p.y * UNITS_PER_METER}`),
            ].join(" ")}
          />
        </>
      )}

      {/* Fuente de agua arrastrable: gota + etiqueta para que se entienda qué es. */}
      <g
        className="water-source-draggable-group"
        transform={`translate(${sourceX * UNITS_PER_METER} ${sourceY * UNITS_PER_METER})`}
      >
        <circle
          className="water-source-draggable"
          r={handleRadius * 1.5}
          onPointerDown={handleSourcePointerDown}
          data-testid="water-source-draggable"
        />
        <path
          className="water-source-drop"
          pointerEvents="none"
          d={`M 0 ${-12 / zoom} C ${9 / zoom} 0 ${11 / zoom} ${5 / zoom} 0 ${12 / zoom} C ${-11 / zoom} ${5 / zoom} ${-9 / zoom} 0 0 ${-12 / zoom} Z`}
        />
        <text className="water-source-tag" y={handleRadius * 1.5 + 26 / zoom} textAnchor="middle">
          Fuente de agua
        </text>
      </g>
    </g>
  );
}
