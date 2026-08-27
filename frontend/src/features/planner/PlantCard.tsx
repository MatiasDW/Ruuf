import type { Plant } from "./types";

interface PlantCardProps {
  plant: Plant;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
}

export function PlantCard({ plant, quantity, onQuantityChange }: PlantCardProps) {
  return (
    <div className="plant-card">
      <div className="plant-card-header">
        <div className="plant-color-badge" style={{ backgroundColor: plant.color }}>
          <span className="plant-initial">{plant.name.charAt(0).toUpperCase()}</span>
        </div>
        <div className="plant-card-info">
          <h3 className="plant-card-name">{plant.name}</h3>
          <p className="plant-card-category">{plant.category}</p>
        </div>
      </div>

      <div className="plant-card-stepper">
        <button
          type="button"
          onClick={() => onQuantityChange(Math.max(0, quantity - 1))}
          className="stepper-button"
        >
          −
        </button>
        <span className="stepper-value">{quantity}</span>
        <button
          type="button"
          onClick={() => onQuantityChange(quantity + 1)}
          className="stepper-button"
        >
          +
        </button>
      </div>
    </div>
  );
}
