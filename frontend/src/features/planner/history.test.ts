import { describe, expect, it } from "vitest";
import {
  commitEditorChange,
  createEditorSnapshot,
  createEmptyEditorHistory,
  redoEditorChange,
  undoEditorChange,
} from "./history";
import { defaultForm } from "./model";
import type { Placement } from "./types";

const placement = (overrides: Partial<Placement> = {}): Placement => ({
  plant_id: "quillay",
  name: "Quillay",
  x: 3,
  y: 3,
  clearance_radius_m: 1,
  structure_clearance_m: 1,
  water_need: "low",
  liters_per_week: 60,
  color: "#537b56",
  ...overrides,
});

describe("editor history", () => {
  it("records only meaningful editor changes", () => {
    const history = createEmptyEditorHistory();
    const current = createEditorSnapshot(defaultForm, [placement()]);
    const unchanged = createEditorSnapshot(defaultForm, [placement()]);
    const changed = createEditorSnapshot(defaultForm, [placement({ x: 4 })]);

    expect(commitEditorChange(history, current, unchanged)).toEqual(history);
    expect(commitEditorChange(history, current, changed).past).toHaveLength(1);
  });

  it("undoes and redoes plant and house snapshots", () => {
    const current = createEditorSnapshot(defaultForm, [placement()]);
    const movedPlant = createEditorSnapshot(defaultForm, [placement({ x: 4.25, y: 5 })]);
    const resizedHouse = createEditorSnapshot(
      { ...defaultForm, obstacle_width: 8.5, obstacle_x: 5.5, house_shape: "l_shape" },
      [placement({ x: 4.25, y: 5 })],
    );

    const afterPlantMove = commitEditorChange(createEmptyEditorHistory(), current, movedPlant);
    const afterHouseChange = commitEditorChange(afterPlantMove, movedPlant, resizedHouse);

    const undoneHouse = undoEditorChange(afterHouseChange, resizedHouse);
    expect(undoneHouse.snapshot).toMatchObject(movedPlant);
    expect(undoneHouse.history.future).toHaveLength(1);

    const undonePlant = undoEditorChange(undoneHouse.history, movedPlant);
    expect(undonePlant.snapshot).toMatchObject(current);

    const redonePlant = redoEditorChange(undonePlant.history, current);
    expect(redonePlant.snapshot).toMatchObject(movedPlant);

    const redoneHouse = redoEditorChange(redonePlant.history, movedPlant);
    expect(redoneHouse.snapshot).toMatchObject(resizedHouse);
  });

  it("clears redo history after branching from an undone state", () => {
    const current = createEditorSnapshot(defaultForm, [placement()]);
    const movedPlant = createEditorSnapshot(defaultForm, [placement({ x: 5 })]);
    const movedAgain = createEditorSnapshot(defaultForm, [placement({ x: 6 })]);

    const withHistory = commitEditorChange(createEmptyEditorHistory(), current, movedPlant);
    const undone = undoEditorChange(withHistory, movedPlant);
    const branched = commitEditorChange(undone.history, current, movedAgain);

    expect(branched.future).toHaveLength(0);
    expect(branched.past).toHaveLength(1);
  });
});
