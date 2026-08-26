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
import {
  attachStableIds,
  fetchDemoProject,
  fetchLatestRevision,
  fetchProjectLayout,
  fetchSession,
  fetchSiteVersion,
  formFromSiteVersion,
  generatePersistedPlan,
  login as loginRequest,
  planResultFromRevision,
  RevisionConflictError,
  saveRevision,
  toRevisionItems,
} from "./features/planner/persistence";
import type {
  HouseFormFields,
  IrrigationEditorState,
  LayoutRevision,
  PlanResult,
  Placement,
  PlannerForm,
  Plant,
  PlantRequest,
  SaveStatus,
  SessionUser,
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
  const [persistence, setPersistence] = useState<PersistenceState>(anonymousPersistence);
  const [irrigationEditor, setIrrigationEditor] = useState<IrrigationEditorState>({
    isEditing: false,
    sourceX: 2,
    sourceY: 2,
    pipeRoute: [],
    numPipes: 1,
    isDirty: false,
    isSaving: false,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadInitialData() {
      let catalog: Plant[] = [];
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
          catalog = plantsData;
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

      // The persisted workspace is optional: without a session the planner stays anonymous.
      try {
        const user = await fetchSession(controller.signal);
        if (user && !controller.signal.aborted) {
          setPersistence((current) => ({ ...current, user, status: "unsaved" }));
          await restoreWorkspace(user, catalog, controller.signal);
        }
      } catch {
        // Ignored: /api/v1 being unreachable must not break the anonymous flow.
      }
    }

    void loadInitialData();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function restoreWorkspace(
    user: SessionUser,
    catalog: Plant[],
    signal?: AbortSignal,
  ): Promise<void> {
    const project = await fetchDemoProject(signal);
    if (!project) {
      setPersistence((current) => ({
        ...current,
        user,
        status: "unsaved",
        message: "La sesión no tiene un proyecto asignado.",
      }));
      return;
    }
    const layout = await fetchProjectLayout(project.id, signal);
    const revision = layout ? await fetchLatestRevision(layout.id, signal) : null;
    if (!revision || !layout) {
      setPersistence((current) => ({
        ...current,
        user,
        projectId: project.id,
        layoutId: layout?.id ?? null,
        baseRevision: null,
        status: "unsaved",
        message: "",
      }));
      return;
    }

    await adoptRevision(revision, catalog, signal);
    setPersistence((current) => ({
      ...current,
      user,
      projectId: project.id,
      layoutId: layout.id,
      baseRevision: revision.revision,
      conflictRevision: null,
      status: "saved",
      message: "",
    }));
  }

  /** Puts a stored revision back on the canvas, including its yard and house geometry. */
  async function adoptRevision(
    revision: LayoutRevision,
    catalog: Plant[],
    signal?: AbortSignal,
  ): Promise<void> {
    const site = await fetchSiteVersion(revision.site_version, signal).catch(() => null);
    setPlanner((current) => ({
      ...current,
      form: site ? formFromSiteVersion(current.form, site) : current.form,
      result: planResultFromRevision(revision, catalog),
      editorHistory: createEmptyEditorHistory(),
      activeGestureStart: null,
    }));
  }

  function markUnsaved() {
    setPersistence((current) =>
      current.user && (current.status === "saved" || current.status === "error")
        ? { ...current, status: "unsaved", message: "" }
        : current,
    );
  }

  async function signIn(email: string, password: string): Promise<boolean> {
    setPersistence((current) => ({ ...current, busy: true, message: "" }));
    try {
      const user = await loginRequest(email, password);
      setPersistence((current) => ({ ...current, user, status: "unsaved", busy: false }));
      await restoreWorkspace(user, plants);
      return true;
    } catch {
      setPersistence((current) => ({
        ...current,
        busy: false,
        status: "anonymous",
        message: "No pudimos iniciar sesión. Revisa el correo y la clave.",
      }));
      return false;
    }
  }

  async function savePlan(): Promise<void> {
    const projectId = persistence.projectId;
    if (!persistence.user || !projectId || !planner.result) {
      return;
    }
    const placements = planner.result.placements;
    setPersistence((current) => ({ ...current, status: "saving", message: "" }));

    try {
      let layoutId = persistence.layoutId;
      let baseRevision = persistence.baseRevision;
      if (!layoutId || baseRevision === null) {
        // The first save persists the generated layout; the manual edit lands on top of it.
        const generated = await generatePersistedPlan(
          projectId,
          buildPlanPayload(planner.form, requests),
        );
        layoutId = generated.layout_id;
        baseRevision = generated.revision;
      }

      const revision = await saveRevision(layoutId, baseRevision, toRevisionItems(placements));
      setPlanner((current) =>
        current.result
          ? {
              ...current,
              result: {
                ...current.result,
                placements: attachStableIds(current.result.placements, revision.items),
              },
            }
          : current,
      );
      setPersistence((current) => ({
        ...current,
        layoutId,
        baseRevision: revision.revision,
        conflictRevision: null,
        status: "saved",
        message: "",
      }));
    } catch (saveError) {
      if (saveError instanceof RevisionConflictError) {
        setPersistence((current) => ({
          ...current,
          status: "conflict",
          conflictRevision: saveError.currentRevision,
          message: "",
        }));
        return;
      }
      setPersistence((current) => ({
        ...current,
        status: "error",
        message: "No pudimos guardar el plan. Intenta nuevamente.",
      }));
    }
  }

  /** Conflict recovery: adopt the newest revision as base and keep the pending local edit. */
  async function reloadLatestRevision(discardLocalEdit: boolean): Promise<void> {
    if (!persistence.layoutId) {
      return;
    }
    setPersistence((current) => ({ ...current, busy: true, message: "" }));
    try {
      const revision = await fetchLatestRevision(persistence.layoutId);
      if (!revision) {
        setPersistence((current) => ({ ...current, busy: false }));
        return;
      }
      if (discardLocalEdit) {
        await adoptRevision(revision, plants);
      }
      setPersistence((current) => ({
        ...current,
        busy: false,
        baseRevision: revision.revision,
        conflictRevision: null,
        status: discardLocalEdit ? "saved" : "unsaved",
        message: discardLocalEdit
          ? `Cargamos la revisión ${revision.revision}.`
          : `Base actualizada a la revisión ${revision.revision}. Tu edición local sigue aquí: vuelve a guardar.`,
      }));
    } catch {
      setPersistence((current) => ({
        ...current,
        busy: false,
        status: "error",
        message: "No pudimos leer la última revisión.",
      }));
    }
  }

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
    markUnsaved();

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
    markUnsaved();
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
    markUnsaved();
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
    markUnsaved();
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
    markUnsaved();
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
    markUnsaved();
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
              irrigationEditor={irrigationEditor}
              onSetIrrigationEditor={setIrrigationEditor}
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
              persistence={{
                status: persistence.status,
                email: persistence.user?.email ?? null,
                revision: persistence.baseRevision,
                conflictRevision: persistence.conflictRevision,
                busy: persistence.busy,
                message: persistence.message,
              }}
              onSignIn={signIn}
              onSave={savePlan}
              onReloadRevision={reloadLatestRevision}
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

interface PersistenceState {
  user: SessionUser | null;
  projectId: string | null;
  layoutId: string | null;
  baseRevision: number | null;
  conflictRevision: number | null;
  status: SaveStatus;
  busy: boolean;
  message: string;
}

const anonymousPersistence: PersistenceState = {
  user: null,
  projectId: null,
  layoutId: null,
  baseRevision: null,
  conflictRevision: null,
  status: "anonymous",
  busy: false,
  message: "",
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export default App;
