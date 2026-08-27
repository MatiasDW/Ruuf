import type { SiteElementType } from "./types";

interface UnifiedToolsPanelProps {
  lawnZoneDrawMode: boolean;
  onSetLawnZoneDrawMode: (mode: boolean) => void;
  onAddElement: (type: SiteElementType) => void;
}

const TOOLS = [
  { id: "lawn", label: "Césped", emoji: "🌾" },
  { id: "pool", label: "Piscina", emoji: "🏊" },
  { id: "quincho", label: "Quincho", emoji: "🏠" },
  { id: "terrace", label: "Terraza", emoji: "⬜" },
  { id: "path", label: "Camino", emoji: "🛤️" },
];

export function UnifiedToolsPanel({
  lawnZoneDrawMode,
  onSetLawnZoneDrawMode,
  onAddElement,
}: UnifiedToolsPanelProps) {
  return (
    <section className="summary-card tools-panel">
      <div className="sidebar-heading">
        <p className="eyebrow">Agregar al plano</p>
      </div>
      <div className="tools-grid">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            data-testid={tool.id === "lawn" ? "add-lawn-zone-button" : `tool-${tool.id}`}
            className={`tool-button ${tool.id === "lawn" && lawnZoneDrawMode ? "active" : ""}`}
            onClick={() => {
              if (tool.id === "lawn") {
                onSetLawnZoneDrawMode(!lawnZoneDrawMode);
              } else {
                onAddElement(tool.id as SiteElementType);
              }
            }}
            type="button"
            title={tool.label}
          >
            <span className="tool-emoji">{tool.emoji}</span>
            <span className="tool-label">{tool.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
