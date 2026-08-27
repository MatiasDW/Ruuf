import { rectanglePolygon, lShapePolygon, uShapePolygon, tShapePolygon } from "./polygon-presets";
import type { HouseFormFields, PlannerForm } from "./types";

interface HouseInspectorProps {
  form: PlannerForm;
  onHouseChange: (house: HouseFormFields) => void;
}

export function HouseInspector({ form, onHouseChange }: HouseInspectorProps) {
  const presets = [
    { name: "Rectángulo", key: "rectangle", icon: "▭" },
    { name: "L", key: "l_shape", icon: "⌐" },
    { name: "U", key: "u_shape", icon: "⊓" },
    { name: "T", key: "t_shape", icon: "⊥" },
  ];

  function applyPreset(presetKey: string) {
    const x = form.obstacle_x;
    const y = form.obstacle_y;
    const w = form.obstacle_width;
    const h = form.obstacle_height;

    let polygon;
    let shape: "rectangle" | "l_shape" | "polygon" = "rectangle";

    if (presetKey === "rectangle") {
      polygon = rectanglePolygon(x, y, w, h);
      shape = "rectangle";
    } else if (presetKey === "l_shape") {
      polygon = lShapePolygon(x, y, w, h);
      shape = "l_shape";
    } else if (presetKey === "u_shape") {
      polygon = uShapePolygon(x, y, w, h);
      shape = "polygon";
    } else if (presetKey === "t_shape") {
      polygon = tShapePolygon(x, y, w, h);
      shape = "polygon";
    } else {
      return;
    }

    onHouseChange({
      obstacle_x: form.obstacle_x,
      obstacle_y: form.obstacle_y,
      obstacle_width: form.obstacle_width,
      obstacle_height: form.obstacle_height,
      house_shape: shape,
      house_polygon: polygon,
    });
  }

  const vertexCount = form.house_polygon?.length ?? 0;

  return (
    <fieldset className="house-inspector">
      <legend>Casa</legend>

      <div className="form-group">
        <label>Preset de forma</label>
        <div className="preset-buttons">
          {presets.map((preset) => (
            <button
              key={preset.key}
              className={`preset-button ${form.house_shape === preset.key ? "active" : ""}`}
              onClick={() => applyPreset(preset.key)}
              title={preset.name}
              type="button"
              data-testid={`house-preset-${preset.key}`}
            >
              <span className="preset-icon">{preset.icon}</span>
              <span className="preset-label">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      {form.house_polygon && form.house_polygon.length >= 3 && (
        <details className="form-group vertex-details">
          <summary>Vértices ({vertexCount})</summary>
          <ul className="vertex-list">
            {form.house_polygon.map((vertex, index) => (
              <li key={index}>
                <span>
                  {index + 1}. ({vertex.x.toFixed(2)}, {vertex.y.toFixed(2)}) m
                </span>
              </li>
            ))}
          </ul>
          <p className="vertex-hint">
            Haz doble-click en una arista para insertar vértice. Selecciona y presiona Delete para
            eliminar (mínimo 3 vértices).
          </p>
        </details>
      )}
    </fieldset>
  );
}
