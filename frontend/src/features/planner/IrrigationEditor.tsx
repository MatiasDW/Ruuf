import { useState } from "react";
import type { IrrigationEditorState, WaterSourceType } from "./types";

interface IrrigationEditorProps {
  state: IrrigationEditorState;
  yardWidth: number;
  yardHeight: number;
  onStateChange: (state: Partial<IrrigationEditorState>) => void;
  onSave: () => Promise<void>;
}

export function IrrigationEditor({
  state,
  yardWidth,
  yardHeight,
  onStateChange,
  onSave,
}: IrrigationEditorProps) {
  const [error, setError] = useState<string | null>(null);

  const handleSourceXChange = (value: string) => {
    const x = parseFloat(value) || 0;
    onStateChange({ sourceX: Math.max(0, Math.min(x, yardWidth)), isDirty: true });
  };

  const handleSourceYChange = (value: string) => {
    const y = parseFloat(value) || 0;
    onStateChange({ sourceY: Math.max(0, Math.min(y, yardHeight)), isDirty: true });
  };

  const handleNumPipesChange = (num: 1 | 2 | 3 | 4) => {
    onStateChange({ numPipes: num, isDirty: true });
  };

  const handleWaterSourceTypeChange = (type: WaterSourceType) => {
    onStateChange({ waterSourceType: type, isDirty: true });
  };

  const currentWaterSourceType = state.waterSourceType || "house_tap";

  const handleAddRoutePoint = () => {
    const newRoute = [...state.pipeRoute, { x: state.sourceX, y: state.sourceY }];
    onStateChange({ pipeRoute: newRoute, isDirty: true });
  };

  const handleRemoveRoutePoint = (index: number) => {
    const newRoute = state.pipeRoute.filter((_, i) => i !== index);
    onStateChange({ pipeRoute: newRoute, isDirty: true });
  };

  const handleSave = async () => {
    try {
      setError(null);
      onStateChange({ isSaving: true });
      await onSave();
      onStateChange({ isSaving: false, isDirty: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving network design");
      onStateChange({ isSaving: false });
    }
  };

  return (
    <div className="irrigation-editor" data-testid="irrigation-editor">
      <div className="editor-header">
        <h3>Diseño de red de riego</h3>
        <button
          className="close-button"
          aria-label="Cerrar editor"
          onClick={() => onStateChange({ isEditing: false })}
        >
          ✕
        </button>
      </div>

      <div className="editor-form">
        <div className="form-group">
          <label htmlFor="source-x">Posición X (m)</label>
          <input
            id="source-x"
            type="number"
            value={state.sourceX}
            onChange={(e) => handleSourceXChange(e.target.value)}
            min="0"
            max={yardWidth}
            step="0.1"
          />
        </div>

        <div className="form-group">
          <label htmlFor="source-y">Posición Y (m)</label>
          <input
            id="source-y"
            type="number"
            value={state.sourceY}
            onChange={(e) => handleSourceYChange(e.target.value)}
            min="0"
            max={yardHeight}
            step="0.1"
          />
        </div>

        <div className="form-group">
          <label>Número de tuberías</label>
          <div className="pipes-selector">
            {[1, 2, 3, 4].map((num) => (
              <button
                key={num}
                className={`pipe-button ${state.numPipes === num ? "active" : ""}`}
                onClick={() => handleNumPipesChange(num as 1 | 2 | 3 | 4)}
                aria-pressed={state.numPipes === num}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Tipo de fuente de agua</label>
          <div className="water-source-selector">
            {[
              { type: "house_tap", icon: "🚰", label: "Grifo de casa" },
              { type: "pump", icon: "⛽", label: "Bomba" },
              { type: "well", icon: "🕳️", label: "Pozo" },
              { type: "tank", icon: "🪣", label: "Estanque" },
              { type: "municipal", icon: "🏛️", label: "Municipal" },
            ].map(({ type, icon, label }) => (
              <button
                key={type}
                className={`water-source-button ${currentWaterSourceType === type ? "active" : ""}`}
                onClick={() => handleWaterSourceTypeChange(type as WaterSourceType)}
                title={label}
                aria-pressed={currentWaterSourceType === type}
              >
                <span className="water-icon">{icon}</span>
                <span className="water-label">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Ruta de tubería principal</label>
          <div className="route-list">
            {state.pipeRoute.length === 0 ? (
              <p className="empty-route">No hay puntos en la ruta</p>
            ) : (
              <ul>
                {state.pipeRoute.map((point, index) => (
                  <li key={index}>
                    <span>
                      {point.x.toFixed(1)}, {point.y.toFixed(1)}
                    </span>
                    <button
                      className="remove-button"
                      onClick={() => handleRemoveRoutePoint(index)}
                      aria-label={`Eliminar punto ${index + 1}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button className="add-route-button" onClick={handleAddRoutePoint}>
            + Agregar punto
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <button
          className="save-button"
          onClick={handleSave}
          disabled={state.isSaving || !state.isDirty}
          data-testid="save-irrigation-network"
        >
          {state.isSaving ? "Guardando..." : "Guardar red de riego"}
        </button>
      </div>
    </div>
  );
}
