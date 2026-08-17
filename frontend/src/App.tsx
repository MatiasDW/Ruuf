import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./app/AppShell";
import { createPlan, fetchPlants, fetchSystemHealth } from "./features/planner/api";
import {
  applyHouseFields,
  commitEditorChange,
  createEditorSnapshot,
  createEmptyEditorHistory,
  type EditorSnapshot,
  hasRedoHistory,
  hasUndoHistory,
  redoEditorChange,
  undoEditorChange,
} from "./features/planner/history";
import { buildInitialRequests, buildPlanPayload, defaultForm } from "./features/planner/model";
import type {
  HouseFormFields,
  PlanResult,
  Placement,
  PlannerForm,
  Plant,
  PlantRequest,
  SystemHealth,
  UnplacedItem,
} from "./features/planner/types";
import { HomeView } from "./pages/HomeView";
import { PlanView } from "./pages/PlanView";
import { PlantsView } from "./pages/PlantsView";
import { ProjectView } from "./pages/ProjectView";

function App() {
  return (
    <BrowserRouter>
      <PlannerApplication />
    </BrowserRouter>
  );
}

function PlannerApplication() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [requests, setRequests] = useState<PlantRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [planner, setPlanner] = useState<PlannerState>({
    form: defaultForm,
    result: null,
    editorHistory: createEmptyEditorHistory(),
    activeGestureStart: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadInitialData() {
      try {
        const [plantsData, healthData] = await Promise.all([
          fetchPlants(controller.signal),
          fetchSystemHealth(controller.signal),
        ]);
        const initialRequests = buildInitialRequests(plantsData);
        const initialResult = initialRequests.length
          ? await createPlan(buildPlanPayload(defaultForm, initialRequests), controller.signal)
          : null;

        if (!controller.signal.aborted) {
          setPlants(plantsData);
          setRequests(initialRequests);
          setSystemHealth(healthData);
          setPlanner((current) => ({
            ...current,
            result: initialResult,
            editorHistory: createEmptyEditorHistory(),
            activeGestureStart: null,
          }));
        }
      } catch (loadError) {
        if (!isAbortError(loadError)) {
          setError("No pudimos cargar el planificador. Intenta nuevamente.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();
    return () => controller.abort();
  }, []);

  function updateFormField<Key extends keyof PlannerForm>(field: Key, value: PlannerForm[Key]) {
    setPlanner((current) => ({
      ...current,
      form: { ...current.form, [field]: value },
    }));
  }

  function updatePlantQuantity(plant: Plant, quantity: number) {
    const safeQuantity = Math.max(0, quantity);
    setRequests((current) => {
      const existing = current.find((item) => item.plant_id === plant.id);
      if (!existing) {
        return safeQuantity
          ? [...current, { plant_id: plant.id, name: plant.name, quantity: safeQuantity }]
          : current;
      }
      return current.map((item) =>
        item.plant_id === plant.id ? { ...item, quantity: safeQuantity } : item,
      );
    });
  }

  async function generatePlan(): Promise<boolean> {
    setLoading(true);
    setError("");

    try {
      const data = await createPlan(buildPlanPayload(planner.form, requests));
      setPlanner((current) => ({
        ...current,
        result: data,
        editorHistory: createEmptyEditorHistory(),
        activeGestureStart: null,
      }));
      return true;
    } catch {
      setError("No pudimos generar el plan. Revisa los datos e intenta nuevamente.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function replaceConflict(unplacedItem: UnplacedItem): Promise<void> {
    const suggestionName = unplacedItem.suggestions.at(0);
    const replacement = plants.find((plant) => plant.name === suggestionName);
    if (!replacement) {
      return;
    }

    const nextRequests = requests.map((item) =>
      item.name === unplacedItem.name
        ? { ...item, plant_id: replacement.id, name: replacement.name }
        : item,
    );
    setRequests(nextRequests);
    setLoading(true);
    setError("");
    try {
      const nextResult = await createPlan(buildPlanPayload(planner.form, nextRequests));
      setPlanner((current) => ({
        ...current,
        result: nextResult,
        editorHistory: createEmptyEditorHistory(),
        activeGestureStart: null,
      }));
    } catch {
      setError("No pudimos aplicar el reemplazo.");
    } finally {
      setLoading(false);
    }
  }

  function updatePlacement(index: number, placement: Placement) {
    setPlanner((current) => {
      if (!current.result) {
        return current;
      }
      const placements = current.result.placements.map((item, itemIndex) =>
        itemIndex === index ? placement : item,
      );
      const nextHistory = commitEditorChange(
        current.editorHistory,
        createEditorSnapshot(current.form, current.result.placements),
        createEditorSnapshot(current.form, placements),
      );
      return {
        ...current,
        result: {
          ...current.result,
          placements,
        },
        editorHistory: nextHistory,
      };
    });
  }

  function previewPlacement(index: number, placement: Placement) {
    setPlanner((current) => {
      if (!current.result) {
        return current;
      }
      return {
        ...current,
        result: {
          ...current.result,
          placements: current.result.placements.map((item, itemIndex) =>
            itemIndex === index ? placement : item,
          ),
        },
      };
    });
  }

  function updateHouse(nextHouse: HouseFormFields) {
    setPlanner((current) => {
      const nextForm = applyHouseFields(current.form, nextHouse);
      const placements = current.result?.placements ?? [];
      const nextHistory = commitEditorChange(
        current.editorHistory,
        createEditorSnapshot(current.form, placements),
        createEditorSnapshot(nextForm, placements),
      );
      return {
        ...current,
        form: nextForm,
        editorHistory: nextHistory,
      };
    });
  }

  function previewHouse(nextHouse: HouseFormFields) {
    setPlanner((current) => ({
      ...current,
      form: applyHouseFields(current.form, nextHouse),
    }));
  }

  function startEditorGesture() {
    setPlanner((current) => {
      if (current.activeGestureStart) {
        return current;
      }
      return {
        ...current,
        activeGestureStart: createEditorSnapshot(current.form, current.result?.placements ?? []),
      };
    });
  }

  function commitEditorGesture() {
    setPlanner((current) => {
      if (!current.activeGestureStart) {
        return current;
      }
      const currentSnapshot = createEditorSnapshot(current.form, current.result?.placements ?? []);
      return {
        ...current,
        editorHistory: commitEditorChange(
          current.editorHistory,
          current.activeGestureStart,
          currentSnapshot,
        ),
        activeGestureStart: null,
      };
    });
  }

  function cancelEditorGesture() {
    setPlanner((current) => {
      if (!current.activeGestureStart) {
        return current;
      }
      return {
        ...current,
        form: applyHouseFields(current.form, current.activeGestureStart.house),
        result: current.result
          ? { ...current.result, placements: current.activeGestureStart.placements }
          : current.result,
        activeGestureStart: null,
      };
    });
  }

  function undoEditorChangeRequest() {
    setPlanner((current) => {
      const currentSnapshot = createEditorSnapshot(current.form, current.result?.placements ?? []);
      const { history, snapshot } = undoEditorChange(current.editorHistory, currentSnapshot);
      if (!snapshot) {
        return current;
      }
      return {
        ...current,
        form: applyHouseFields(current.form, snapshot.house),
        result: current.result
          ? { ...current.result, placements: snapshot.placements }
          : current.result,
        editorHistory: history,
      };
    });
  }

  function redoEditorChangeRequest() {
    setPlanner((current) => {
      const currentSnapshot = createEditorSnapshot(current.form, current.result?.placements ?? []);
      const { history, snapshot } = redoEditorChange(current.editorHistory, currentSnapshot);
      if (!snapshot) {
        return current;
      }
      return {
        ...current,
        form: applyHouseFields(current.form, snapshot.house),
        result: current.result
          ? { ...current.result, placements: snapshot.placements }
          : current.result,
        editorHistory: history,
      };
    });
  }

  return (
    <AppShell systemHealth={systemHealth}>
      <Routes>
        <Route path="/" element={<HomeView result={planner.result} plantCount={plants.length} />} />
        <Route
          path="/proyecto"
          element={<ProjectView form={planner.form} onFormChange={updateFormField} />}
        />
        <Route
          path="/plantas"
          element={
            <PlantsView
              plants={plants}
              requests={requests}
              loading={loading}
              error={error}
              onQuantityChange={updatePlantQuantity}
              onGenerate={generatePlan}
            />
          }
        />
        <Route
          path="/plan"
          element={
            <PlanView
              form={planner.form}
              result={planner.result}
              loading={loading}
              error={error}
              canUndo={hasUndoHistory(planner.editorHistory)}
              canRedo={hasRedoHistory(planner.editorHistory)}
              onEditorGestureStart={startEditorGesture}
              onEditorGestureCommit={commitEditorGesture}
              onEditorGestureCancel={cancelEditorGesture}
              onHouseChange={updateHouse}
              onHousePreview={previewHouse}
              onPlacementChange={updatePlacement}
              onPlacementPreview={previewPlacement}
              onReplaceConflict={replaceConflict}
              onUndo={undoEditorChangeRequest}
              onRedo={redoEditorChangeRequest}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

interface PlannerState {
  form: PlannerForm;
  result: PlanResult | null;
  editorHistory: ReturnType<typeof createEmptyEditorHistory>;
  activeGestureStart: EditorSnapshot | null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export default App;
