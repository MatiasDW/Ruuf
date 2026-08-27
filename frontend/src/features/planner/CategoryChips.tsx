import type { PlantCategory } from "./types";

interface CategoryChipsProps {
  selected: PlantCategory | null;
  onChange: (category: PlantCategory | null) => void;
}

const CATEGORIES: Array<{ value: PlantCategory; label: string }> = [
  { value: "tree", label: "Árboles" },
  { value: "shrub", label: "Arbustos" },
  { value: "flower", label: "Flores" },
  { value: "grass", label: "Césped" },
];

export function CategoryChips({ selected, onChange }: CategoryChipsProps) {
  return (
    <div className="category-chips">
      <button
        type="button"
        className={`chip ${selected === null ? "active" : ""}`}
        onClick={() => onChange(null)}
      >
        Todas
      </button>
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          type="button"
          className={`chip ${selected === cat.value ? "active" : ""}`}
          onClick={() => onChange(cat.value)}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
