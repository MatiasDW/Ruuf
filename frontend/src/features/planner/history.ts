import type { HouseFormFields, Placement, PlannerForm } from "./types";

export interface EditorSnapshot {
  house: HouseFormFields;
  placements: Placement[];
}

export interface EditorHistoryState {
  past: EditorSnapshot[];
  future: EditorSnapshot[];
}

export function createEmptyEditorHistory(): EditorHistoryState {
  return { past: [], future: [] };
}

export function createEditorSnapshot(form: PlannerForm, placements: Placement[]): EditorSnapshot {
  return {
    house: pickHouseFields(form),
    placements: placements.map(clonePlacement),
  };
}

export function pickHouseFields(form: PlannerForm): HouseFormFields {
  return {
    obstacle_width: form.obstacle_width,
    obstacle_height: form.obstacle_height,
    obstacle_x: form.obstacle_x,
    obstacle_y: form.obstacle_y,
    house_shape: form.house_shape,
  };
}

export function applyHouseFields(form: PlannerForm, house: HouseFormFields): PlannerForm {
  return {
    ...form,
    ...house,
  };
}

export function commitEditorChange(
  history: EditorHistoryState,
  current: EditorSnapshot,
  next: EditorSnapshot,
): EditorHistoryState {
  if (snapshotsEqual(current, next)) {
    return history;
  }
  return {
    past: [...history.past, cloneSnapshot(current)],
    future: [],
  };
}

export function undoEditorChange(
  history: EditorHistoryState,
  current: EditorSnapshot,
): { history: EditorHistoryState; snapshot: EditorSnapshot | null } {
  const snapshot = history.past.at(-1);
  if (!snapshot) {
    return { history, snapshot: null };
  }
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, cloneSnapshot(current)],
    },
    snapshot: cloneSnapshot(snapshot),
  };
}

export function redoEditorChange(
  history: EditorHistoryState,
  current: EditorSnapshot,
): { history: EditorHistoryState; snapshot: EditorSnapshot | null } {
  const snapshot = history.future.at(-1);
  if (!snapshot) {
    return { history, snapshot: null };
  }
  return {
    history: {
      past: [...history.past, cloneSnapshot(current)],
      future: history.future.slice(0, -1),
    },
    snapshot: cloneSnapshot(snapshot),
  };
}

export function hasUndoHistory(history: EditorHistoryState): boolean {
  return history.past.length > 0;
}

export function hasRedoHistory(history: EditorHistoryState): boolean {
  return history.future.length > 0;
}

function snapshotsEqual(first: EditorSnapshot, second: EditorSnapshot): boolean {
  return (
    houseFieldsEqual(first.house, second.house) &&
    placementsEqual(first.placements, second.placements)
  );
}

function houseFieldsEqual(first: HouseFormFields, second: HouseFormFields): boolean {
  return (
    first.obstacle_width === second.obstacle_width &&
    first.obstacle_height === second.obstacle_height &&
    first.obstacle_x === second.obstacle_x &&
    first.obstacle_y === second.obstacle_y &&
    first.house_shape === second.house_shape
  );
}

function placementsEqual(first: Placement[], second: Placement[]): boolean {
  if (first.length !== second.length) {
    return false;
  }
  return first.every((placement, index) => {
    const nextPlacement = second[index];
    if (!nextPlacement) {
      return false;
    }
    return (
      placement.plant_id === nextPlacement.plant_id &&
      placement.name === nextPlacement.name &&
      placement.x === nextPlacement.x &&
      placement.y === nextPlacement.y &&
      placement.clearance_radius_m === nextPlacement.clearance_radius_m &&
      placement.structure_clearance_m === nextPlacement.structure_clearance_m &&
      placement.water_need === nextPlacement.water_need &&
      placement.liters_per_week === nextPlacement.liters_per_week &&
      placement.color === nextPlacement.color
    );
  });
}

function cloneSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  return {
    house: { ...snapshot.house },
    placements: snapshot.placements.map(clonePlacement),
  };
}

function clonePlacement(placement: Placement): Placement {
  return { ...placement };
}
