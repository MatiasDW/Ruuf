import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./app/AppShell";
import { createPlan, fetchPlants, fetchSystemHealth } from "./features/planner/api";
import { buildInitialRequests, buildPlanPayload, defaultForm } from "./features/planner/model";
import type {
  PlanResult,
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
  const [form, setForm] = useState<PlannerForm>(defaultForm);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);

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
          setResult(initialResult);
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
    setForm((current) => ({ ...current, [field]: value }));
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
      const data = await createPlan(buildPlanPayload(form, requests));
      setResult(data);
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
      setResult(await createPlan(buildPlanPayload(form, nextRequests)));
    } catch {
      setError("No pudimos aplicar el reemplazo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell systemHealth={systemHealth}>
      <Routes>
        <Route path="/" element={<HomeView result={result} plantCount={plants.length} />} />
        <Route
          path="/proyecto"
          element={<ProjectView form={form} onFormChange={updateFormField} />}
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
              form={form}
              plants={plants}
              result={result}
              loading={loading}
              error={error}
              onReplaceConflict={replaceConflict}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export default App;
