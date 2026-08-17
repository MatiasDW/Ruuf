import type {
  FilterMode,
  LandscapeStyle,
  LegendItem,
  PlanPayload,
  PlanResult,
  PlannerForm,
  Plant,
  PlantCategory,
  PlantRequest,
  Sunlight,
  WaterNeed,
} from "./types";

export const defaultForm: PlannerForm = {
  yard_width: 24,
  yard_height: 14,
  sunlight: "full_sun",
  style: "mediterranean",
  obstacle_width: 7,
  obstacle_height: 5,
  obstacle_x: 4,
  obstacle_y: 4,
  house_shape: "rectangle",
  water_price_clp_per_m3: 1200,
  fixed_charge_clp: 3000,
};

export const categoryLabels: Record<PlantCategory, string> = {
  tree: "Árboles de copa",
  shrub: "Arbustos y setos",
  flower: "Flores y perennes",
  grass: "Cubresuelos",
};

export const waterLabels: Record<WaterNeed, string> = {
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
};

export const waterColors: Record<WaterNeed, string> = {
  low: "#1b5e20",
  medium: "#4f7f55",
  high: "#7c4a36",
};

export const typeColors: Record<PlantCategory, string> = {
  tree: "#275334",
  shrub: "#8db696",
  flower: "#7c4a36",
  grass: "#c0d9b4",
};

export const sunlightOptions: Array<{ value: Sunlight; label: string }> = [
  { value: "full_sun", label: "Sol directo" },
  { value: "partial_shade", label: "Sombra parcial" },
  { value: "shade", label: "Sombra" },
];

export const styleOptions: Array<{ value: LandscapeStyle; label: string }> = [
  { value: "mediterranean", label: "Mediterráneo" },
  { value: "native", label: "Nativo" },
  { value: "formal", label: "Formal" },
  { value: "lush", label: "Frondoso" },
];

export function buildInitialRequests(plants: Plant[]): PlantRequest[] {
  return plants.slice(0, 5).map((plant) => ({
    plant_id: plant.id,
    name: plant.name,
    quantity: plant.category === "tree" ? 2 : 3,
  }));
}

export function buildPlanPayload(form: PlannerForm, requests: PlantRequest[]): PlanPayload {
  return {
    site: {
      yard_width: form.yard_width,
      yard_height: form.yard_height,
      sunlight: form.sunlight,
      style: form.style,
    },
    irrigation: {
      water_price_clp_per_m3: form.water_price_clp_per_m3,
      fixed_charge_clp: form.fixed_charge_clp,
    },
    obstacles: [
      {
        x: form.obstacle_x,
        y: form.obstacle_y,
        width: form.obstacle_width,
        height: form.obstacle_height,
        label: "House",
      },
    ],
    requests: requests
      .filter((item) => item.quantity > 0)
      .map((item) => ({
        plant_id: item.plant_id,
        quantity: item.quantity,
      })),
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function buildLegendItems(filterMode: FilterMode): LegendItem[] {
  if (filterMode === "water") {
    return [
      { label: "Riego bajo", color: waterColors.low },
      { label: "Riego medio", color: waterColors.medium },
      { label: "Riego alto", color: waterColors.high },
      { label: "Superficie no plantable", swatchClass: "legend-swatch-outline" },
    ];
  }

  return [
    { label: "Árboles de copa", color: typeColors.tree },
    { label: "Arbustos y setos", color: typeColors.shrub },
    { label: "Flores y perennes", color: typeColors.flower },
    { label: "Superficie no plantable", swatchClass: "legend-swatch-outline" },
  ];
}

export function highestWaterNeed(result: PlanResult | null): WaterNeed {
  const rank: Record<WaterNeed, number> = { low: 0, medium: 1, high: 2 };
  return (
    result?.placements.reduce<WaterNeed>(
      (highest, item) => (rank[item.water_need] > rank[highest] ? item.water_need : highest),
      "low",
    ) ?? "low"
  );
}

export function shortLabel(name: string): string {
  return name
    .split(" ")
    .map((part) => part.at(0) ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function inferCategory(name: string): PlantCategory {
  if (name.toLowerCase().includes("tree") || name === "Quillay" || name === "Jacaranda") {
    return "tree";
  }
  if (name === "Rosemary") {
    return "shrub";
  }
  if (name === "Coiron") {
    return "grass";
  }
  return "flower";
}

export function formatIssueReason(reason: string): string {
  if (reason.startsWith("Needs ")) {
    return reason
      .replace("Needs ", "Necesita ")
      .replace(" but the site is ", ", pero el terreno tiene ")
      .replaceAll("partial_shade", "sombra parcial")
      .replaceAll("full_sun", "sol directo")
      .replaceAll("shade", "sombra");
  }
  if (reason.startsWith("No remaining position")) {
    return "No queda una posición que respete los límites, obstáculos y distancias mínimas.";
  }
  return reason;
}
