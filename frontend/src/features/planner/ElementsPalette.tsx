import type { SiteElementType } from "./types";

interface ElementsPaletteProps {
  onAddElement: (type: SiteElementType) => void;
}

const ELEMENT_TYPES: Array<{ type: SiteElementType; label: string; emoji: string }> = [
  { type: "pool", label: "Piscina", emoji: "🏊" },
  { type: "quincho", label: "Quincho", emoji: "🏠" },
  { type: "terrace", label: "Terraza", emoji: "⬜" },
  { type: "path", label: "Camino", emoji: "🛤️" },
];

export function ElementsPalette({ onAddElement }: ElementsPaletteProps) {
  return (
    <fieldset className="elements-palette">
      <legend>Agregar elemento</legend>
      <div className="element-buttons">
        {ELEMENT_TYPES.map(({ type, label, emoji }) => (
          <button
            key={type}
            className="element-button"
            onClick={() => onAddElement(type)}
            title={label}
            type="button"
          >
            <span className="element-emoji">{emoji}</span>
            <span className="element-label">{label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
