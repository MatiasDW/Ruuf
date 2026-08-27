import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Stepper } from "../features/planner/Stepper";
import { StyleCard } from "../features/planner/StyleCard";
import { CategoryChips } from "../features/planner/CategoryChips";
import { PlantCard } from "../features/planner/PlantCard";
import type { Plant, PlantCategory, PlantRequest, LandscapeStyle } from "../features/planner/types";

interface PlantsViewProps {
  plants: Plant[];
  requests: PlantRequest[];
  loading: boolean;
  error: string;
  style?: LandscapeStyle;
  onQuantityChange: (plant: Plant, quantity: number) => void;
  onGenerate: () => Promise<boolean>;
}

const STYLE_LABELS: Record<LandscapeStyle, string> = {
  mediterranean: "Mediterráneo",
  native: "Nativo",
  formal: "Formal",
  lush: "Frondoso",
};

export function PlantsView({
  plants,
  requests,
  loading,
  error,
  style = "native",
  onQuantityChange,
  onGenerate,
}: PlantsViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<PlantCategory | null>(null);
  const navigate = useNavigate();

  const visiblePlants = selectedCategory
    ? plants.filter((p) => p.category === selectedCategory)
    : plants;

  const selectedPlants = requests.filter((r) => r.quantity > 0);

  const suggestedPlants = plants
    .filter(
      (p) => p.style_tags.includes(style) && !selectedPlants.some((sp) => sp.plant_id === p.id),
    )
    .slice(0, 4);

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
    <div className="plants-view-new">
      <div className="plants-container">
        <Stepper currentStep={3} totalSteps={4} />
        <h1 className="plants-title">Elige plantas para tu jardín</h1>

        {/* Preferencias */}
        <section className="plants-section">
          <h2 className="section-title">Tus preferencias</h2>
          <div className="styles-grid">
            {Object.entries(STYLE_LABELS).map(([key, label]) => (
              <StyleCard
                key={key}
                style={key as LandscapeStyle}
                label={label}
                isSelected={style === key}
                onChange={() => {}}
              />
            ))}
          </div>
        </section>

        {/* Wishlist */}
        <section className="plants-section">
          <h2 className="section-title">Mi selección</h2>
          <CategoryChips selected={selectedCategory} onChange={setSelectedCategory} />

          {error ? <p className="error-banner">{error}</p> : null}
          {loading ? <p>Cargando...</p> : null}

          <div className="plants-grid">
            {visiblePlants.map((plant) => (
              <PlantCard
                key={plant.id}
                plant={plant}
                quantity={quantityFor(plant.id)}
                onQuantityChange={(qty) => onQuantityChange(plant, qty)}
              />
            ))}
          </div>
        </section>

        {/* Tu lista */}
        {selectedPlants.length > 0 && (
          <section className="plants-section">
            <h2 className="section-title">Tu lista ({selectedPlants.length})</h2>
            <div className="selected-plants">
              {selectedPlants.map((req) => {
                const plant = plants.find((p) => p.id === req.plant_id);
                return plant ? (
                  <div key={plant.id} className="selected-plant-item">
                    <span>
                      {plant.name} × {req.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onQuantityChange(plant, 0)}
                      className="remove-button"
                    >
                      ✕
                    </button>
                  </div>
                ) : null;
              })}
            </div>
          </section>
        )}

        {/* Sugerencias */}
        {suggestedPlants.length > 0 && (
          <section className="plants-section">
            <h2 className="section-title">Sugerencias para tu estilo {STYLE_LABELS[style]}</h2>
            <div className="plants-grid">
              {suggestedPlants.map((plant) => (
                <div key={plant.id} className="suggestion-card">
                  <div className="suggestion-badge" style={{ backgroundColor: plant.color }}>
                    {plant.name.charAt(0)}
                  </div>
                  <p className="suggestion-name">{plant.name}</p>
                  <button
                    type="button"
                    onClick={() => onQuantityChange(plant, 1)}
                    className="suggestion-add"
                  >
                    Añadir
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <form onSubmit={submitSelection} className="plants-actions">
          <button type="submit" className="plants-button" disabled={selectedPlants.length === 0}>
            Continuar al plano
          </button>
        </form>
      </div>
    </div>
  );
}
