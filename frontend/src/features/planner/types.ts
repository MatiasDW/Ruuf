export type PlantCategory = "tree" | "shrub" | "flower" | "grass";
export type WaterNeed = "low" | "medium" | "high";
export type Sunlight = "full_sun" | "partial_shade" | "shade";
export type LandscapeStyle = "mediterranean" | "native" | "formal" | "lush";
export type FilterMode = "type" | "water";

export interface Plant {
  id: string;
  name: string;
  category: PlantCategory;
  clearance_radius_m: number;
  structure_clearance_m: number;
  sunlight: Sunlight[];
  water_need: WaterNeed;
  liters_per_week: number;
  style_tags: LandscapeStyle[];
  color: string;
}

export interface PlantRequest {
  plant_id: string;
  name: string;
  quantity: number;
}

export interface PlannerForm {
  yard_width: number;
  yard_height: number;
  sunlight: Sunlight;
  style: LandscapeStyle;
  obstacle_width: number;
  obstacle_height: number;
  obstacle_x: number;
  obstacle_y: number;
  water_price_clp_per_m3: number;
  fixed_charge_clp: number;
}

export interface PlanPayload {
  site: {
    yard_width: number;
    yard_height: number;
    sunlight: Sunlight;
    style: LandscapeStyle;
  };
  irrigation: {
    water_price_clp_per_m3: number;
    fixed_charge_clp: number;
  };
  obstacles: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
  }>;
  requests: Array<{
    plant_id: string;
    quantity: number;
  }>;
}

export interface Placement {
  plant_id: string;
  name: string;
  x: number;
  y: number;
  clearance_radius_m: number;
  structure_clearance_m: number;
  water_need: WaterNeed;
  liters_per_week: number;
  color: string;
}

export interface UnplacedItem {
  name: string;
  reason: string;
  suggestions: string[];
}

export interface PlanResult {
  summary: {
    requested_items: number;
    placed_items: number;
    unplaced_items: number;
    grid_step_m: number;
    fits: boolean;
  };
  placements: Placement[];
  unplaced: UnplacedItem[];
  irrigation: {
    weekly_liters: number;
    monthly_m3: number;
    monthly_variable_cost_clp: number;
    monthly_total_cost_clp: number;
  };
}

export interface SystemHealth {
  status: string;
  database: string;
  redis: string;
  stitch: string;
}

export interface LegendItem {
  label: string;
  color?: string;
  swatchClass?: string;
}
