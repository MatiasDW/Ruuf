import { inferCategory, shortLabel, typeColors, waterColors, waterLabels } from "./model";
import type { FilterMode, PlanResult, PlannerForm } from "./types";

interface GardenMapProps {
  form: PlannerForm;
  result: PlanResult;
  filterMode: FilterMode;
  zoom: number;
}

const UNITS_PER_METER = 100;

export function GardenMap({ form, result, filterMode, zoom }: GardenMapProps) {
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
  const poolWidth = Math.min(worldWidth * 0.18, 360);
  const poolHeight = Math.min(worldHeight * 0.18, 220);
  const poolX = Math.min(worldWidth * 0.68, worldWidth - poolWidth - 80);
  const poolY = Math.min(worldHeight * 0.62, worldHeight - poolHeight - 80);

  return (
    <svg
      className="garden-map"
      viewBox={`${viewX} ${viewY} ${visibleWidth} ${visibleHeight}`}
      role="img"
      aria-label={`Plano de jardín de ${form.yard_width} por ${form.yard_height} metros con ${result.placements.length} plantas`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="yard-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#edf1e7" />
          <stop offset="1" stopColor="#dce7d2" />
        </linearGradient>
        <pattern id="deck-pattern" width="28" height="28" patternUnits="userSpaceOnUse">
          <rect width="18" height="28" fill="#c9ad8c" />
          <rect x="18" width="10" height="28" fill="#b99570" />
        </pattern>
        <filter id="soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="18" stdDeviation="20" floodColor="#26402e" floodOpacity="0.14" />
        </filter>
      </defs>

      <rect width={worldWidth} height={worldHeight} rx="50" fill="url(#yard-fill)" />
      <path
        d={`M ${worldWidth * 0.04} ${worldHeight * 0.8} Q ${worldWidth * 0.48} ${worldHeight * 0.7}, ${worldWidth * 0.96} ${worldHeight * 0.76}`}
        fill="none"
        stroke="#d3ccbd"
        strokeWidth="72"
        strokeLinecap="round"
      />
      <ellipse
        cx={worldWidth * 0.76}
        cy={worldHeight * 0.4}
        rx={worldWidth * 0.2}
        ry={worldHeight * 0.22}
        fill="#c7d9ac"
        opacity="0.86"
      />

      <g filter="url(#soft-shadow)">
        <rect
          x={house.x}
          y={house.y}
          width={house.width}
          height={house.height}
          rx="30"
          fill="#f8f7f1"
          stroke="#8c9189"
          strokeWidth="12"
        />
        <line
          x1={house.x + house.width / 2}
          y1={house.y + 28}
          x2={house.x + house.width / 2}
          y2={house.y + house.height - 28}
          stroke="#c9cbc5"
          strokeWidth="8"
        />
        <line
          x1={house.x + 28}
          y1={house.y + house.height / 2}
          x2={house.x + house.width - 28}
          y2={house.y + house.height / 2}
          stroke="#c9cbc5"
          strokeWidth="8"
        />
        <text
          x={house.x + house.width / 2}
          y={house.y + house.height / 2 + 16}
          textAnchor="middle"
          className="map-label"
        >
          CASA
        </text>
      </g>

      <rect
        x={house.x + house.width * 0.82}
        y={house.y + house.height * 0.08}
        width={Math.max(house.width * 0.8, 260)}
        height={Math.max(house.height * 0.66, 180)}
        rx="24"
        fill="url(#deck-pattern)"
        opacity="0.94"
      />
      <text
        x={house.x + house.width * 1.2}
        y={house.y + house.height * 0.45}
        textAnchor="middle"
        className="map-label map-label-dark"
      >
        TERRAZA
      </text>

      <rect
        x={poolX}
        y={poolY}
        width={poolWidth}
        height={poolHeight}
        rx="24"
        fill="#56879b"
        stroke="#e2d8c7"
        strokeWidth="28"
        filter="url(#soft-shadow)"
      />
      <text
        x={poolX + poolWidth / 2}
        y={poolY + poolHeight / 2 + 16}
        textAnchor="middle"
        className="map-label map-label-light"
      >
        PISCINA
      </text>

      {result.placements.map((placement, index) => {
        const color =
          filterMode === "water"
            ? waterColors[placement.water_need]
            : typeColors[inferCategory(placement.name)];
        const radius = placement.clearance_radius_m * UNITS_PER_METER;

        return (
          <g
            key={`${placement.plant_id}-${index}`}
            className="plant-marker"
            aria-label={`${placement.name}, ${waterLabels[placement.water_need]} riego`}
          >
            <circle
              cx={placement.x * UNITS_PER_METER}
              cy={placement.y * UNITS_PER_METER}
              r={radius}
              fill={color}
              opacity="0.23"
              stroke={color}
              strokeWidth="10"
            />
            <circle
              cx={placement.x * UNITS_PER_METER}
              cy={placement.y * UNITS_PER_METER}
              r={Math.min(radius * 0.42, 74)}
              fill={color}
              stroke="#f4f7ef"
              strokeWidth="10"
              filter="url(#soft-shadow)"
            />
            <text
              x={placement.x * UNITS_PER_METER}
              y={placement.y * UNITS_PER_METER + 16}
              textAnchor="middle"
              className="plant-label"
            >
              {shortLabel(placement.name)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
