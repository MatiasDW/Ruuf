export type PlantCategory = "tree" | "shrub" | "flower" | "grass";
export type WaterNeed = "low" | "medium" | "high";
export type Sunlight = "full_sun" | "partial_shade" | "shade";
export type LandscapeStyle = "mediterranean" | "native" | "formal" | "lush";
export type FilterMode = "type" | "water";
export type HouseShape = "rectangle" | "l_shape";

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
  house_shape: HouseShape;
  water_price_clp_per_m3: number;
  fixed_charge_clp: number;
}

export type HouseFormFields = Pick<
  PlannerForm,
  "obstacle_width" | "obstacle_height" | "obstacle_x" | "obstacle_y" | "house_shape"
>;

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
  /** Identity assigned by Django once the placement belongs to a saved revision. */
  stable_id?: string;
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

export interface SessionUser {
  id: string;
  email: string;
  display_name: string;
}

export interface Paginated<Item> {
  count: number;
  next: string | null;
  previous: string | null;
  results: Item[];
}

export interface ProjectSummary {
  id: string;
  name: string;
}

export interface LayoutSummary {
  id: string;
  project: string;
  name: string;
  current_revision: number;
  updated_at: string;
}

export interface RevisionItem {
  stable_id: string;
  plant_id: string;
  name: string;
  x_m: string;
  y_m: string;
  clearance_radius_m: string;
  color: string;
}

export interface RevisionIssue {
  code: string;
  severity: string;
  message: string;
  item_ids: string[];
  data?: {
    plant_id?: string;
    suggestions?: string[];
  };
}

export interface RevisionIrrigation {
  weekly_liters: string;
  monthly_cubic_meters: string;
  incremental_cost_clp: string;
  projected_bill_cost_clp: string;
}

export interface LayoutRevision {
  id: string;
  layout: string;
  site_version: string;
  revision: number;
  status: string;
  result_summary: {
    requested_items?: number;
    placed_items?: number;
    unplaced_items?: number;
    grid_step_m?: number;
    fits?: boolean;
  };
  items: RevisionItem[];
  validation_issues: RevisionIssue[];
  irrigation_estimates: RevisionIrrigation[];
}

export interface RevisionItemInput {
  stable_id?: string;
  plant_id: string;
  x_m: number;
  y_m: number;
}

export interface SiteFeatureGeometry {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SiteVersionDetail {
  id: string;
  width_m: string;
  height_m: string;
  sunlight: Sunlight;
  preferred_style: LandscapeStyle;
  features: Array<{
    feature_type: string;
    label: string;
    geometry: SiteFeatureGeometry;
  }>;
}

export interface GeneratedPlan extends PlanResult {
  layout_id: string;
  layout_version_id: string;
  revision: number;
}

export type SaveStatus = "anonymous" | "unsaved" | "saving" | "saved" | "conflict" | "error";

export interface PersistenceView {
  status: SaveStatus;
  email: string | null;
  revision: number | null;
  conflictRevision: number | null;
  busy: boolean;
  message: string;
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

export type WaterSourceType = "house_tap" | "pump" | "well" | "tank" | "municipal";

export interface IrrigationNetworkDesign {
  id?: string;
  layout?: string;
  water_source_x: number;
  water_source_y: number;
  water_source_type?: WaterSourceType;
  main_pipe_route: Array<{ x: number; y: number }>;
  num_main_pipes: number;
}

export interface IrrigationEditorState {
  isEditing: boolean;
  sourceX: number;
  sourceY: number;
  pipeRoute: Array<{ x: number; y: number }>;
  numPipes: 1 | 2 | 3 | 4;
  waterSourceType?: WaterSourceType;
  isDirty: boolean;
  isSaving: boolean;
}

export interface LawnZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  water_need: WaterNeed;
  liters_per_m2_week: number;
}
