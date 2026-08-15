import { useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { categoryLabels, waterLabels } from "../features/planner/model";
import type { Plant, PlantCategory, PlantRequest } from "../features/planner/types";

interface PlantsViewProps {
  plants: Plant[];
  requests: PlantRequest[];
  loading: boolean;
  error: string;
  onQuantityChange: (plant: Plant, quantity: number) => void;
  onGenerate: () => Promise<boolean>;
}

type CategoryFilter = "all" | PlantCategory;

const filters: Array<{ value: CategoryFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "tree", label: "Árboles" },
  { value: "shrub", label: "Arbustos" },
  { value: "flower", label: "Flores" },
  { value: "grass", label: "Cubresuelos" },
];

export function PlantsView({
  plants,
  requests,
  loading,
  error,
  onQuantityChange,
  onGenerate,
}: PlantsViewProps) {
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const navigate = useNavigate();
  const visiblePlants = plants.filter((plant) => filter === "all" || plant.category === filter);
  const selectedCount = requests.reduce((total, item) => total + item.quantity, 0);

  function quantityFor(plantId: string): number {
    return requests.find((item) => item.plant_id === plantId)?.quantity ?? 0;
  }

  async function submitSelection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onGenerate()) {
      navigate("/plan");
    }
  }

  return (
    <div className="workflow-view page-enter">
      <header className="workflow-heading plants-heading">
        <p className="eyebrow">Paso 2 de 3</p>
        <h1>Elige lo que te gustaría ver crecer.</h1>
        <p>
          No necesitas saber si todo cabe. El motor revisará espacio, sol y consumo para proponer
          una combinación realista.
        </p>
        <div className="step-track" aria-label="Paso 2 de 3">
          <span className="complete" />
          <span className="complete" />
          <span />
        </div>
      </header>

      <form className="plants-workspace" onSubmit={submitSelection}>
        <div className="catalog-column">
          <div className="filter-row" role="group" aria-label="Filtrar por tipo de planta">
            {filters.map((item) => (
              <button
                key={item.value}
                className={filter === item.value ? "filter-chip active" : "filter-chip"}
                type="button"
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {error ? <p className="error-banner">{error}</p> : null}

          <div className="plant-catalog">
            {visiblePlants.map((plant) => {
              const quantity = quantityFor(plant.id);
              return (
                <article className={quantity ? "plant-card selected" : "plant-card"} key={plant.id}>
                  <div
                    className={`plant-portrait plant-portrait-${plant.category}`}
                    style={{ "--plant-color": plant.color } as CSSProperties}
                    aria-hidden="true"
                  >
                    <span>{plant.name.slice(0, 1)}</span>
                  </div>
                  <div className="plant-card-copy">
                    <span className="plant-category">{categoryLabels[plant.category]}</span>
                    <h2>{plant.name}</h2>
                    <div className="plant-facts">
                      <span>Radio {plant.clearance_radius_m} m</span>
                      <span>{waterLabels[plant.water_need]} riego</span>
                    </div>
                  </div>
                  <div className="quantity-control" aria-label={`Cantidad de ${plant.name}`}>
                    <button
                      type="button"
                      aria-label={`Quitar ${plant.name}`}
                      onClick={() => onQuantityChange(plant, quantity - 1)}
                      disabled={quantity === 0}
                    >
                      −
                    </button>
                    <output aria-live="polite">{quantity}</output>
                    <button
                      type="button"
                      aria-label={`Agregar ${plant.name}`}
                      onClick={() => onQuantityChange(plant, quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="selection-summary">
          <p className="eyebrow">Tu selección</p>
          <strong className="selection-count">{selectedCount}</strong>
          <span>plantas solicitadas</span>
          <div className="selection-list">
            {requests
              .filter((item) => item.quantity > 0)
              .map((item) => (
                <div key={item.plant_id}>
                  <span>{item.name}</span>
                  <strong>× {item.quantity}</strong>
                </div>
              ))}
          </div>
          <p className="summary-note">
            Si una especie no funciona en este terreno, explicaremos por qué y mostraremos
            alternativas.
          </p>
        </aside>

        <div className="workflow-actions">
          <button className="button quiet" type="button" onClick={() => navigate("/proyecto")}>
            Volver al espacio
          </button>
          <button
            className="button primary"
            type="submit"
            disabled={loading || selectedCount === 0}
          >
            {loading ? "Calculando propuesta..." : "Generar mi propuesta"}
          </button>
        </div>
      </form>
    </div>
  );
}
