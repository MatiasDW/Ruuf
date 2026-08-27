import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Stepper } from "../features/planner/Stepper";
import { SunlightChips } from "../features/planner/SunlightChips";
import type { PlannerForm } from "../features/planner/types";

interface ProjectViewProps {
  form: PlannerForm;
  onFormChange: <Key extends keyof PlannerForm>(field: Key, value: PlannerForm[Key]) => void;
}

export function ProjectView({ form, onFormChange }: ProjectViewProps) {
  const navigate = useNavigate();

  function continueToPlants(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate("/plantas");
  }

  return (
    <div className="project-view-new">
      <form onSubmit={continueToPlants} className="project-form-stepped">
        <div className="project-left">
          <Stepper currentStep={1} totalSteps={4} />
          <h2 className="project-title">Define tu espacio</h2>

          {/* Dimensiones Card */}
          <div className="project-card">
            <div className="card-header">
              <span className="material-symbols-outlined">straighten</span>
              <div>
                <h3>Dimensiones del Terreno</h3>
                <p>Ingresa las medidas aproximadas de tu jardín.</p>
              </div>
            </div>
            <div className="card-grid">
              <NumberField
                label="Ancho"
                suffix="m"
                value={form.yard_width}
                min={1}
                onChange={(value) => onFormChange("yard_width", value)}
              />
              <NumberField
                label="Largo"
                suffix="m"
                value={form.yard_height}
                min={1}
                onChange={(value) => onFormChange("yard_height", value)}
              />
            </div>
          </div>

          {/* Condiciones Card */}
          <div className="project-card">
            <div className="card-header">
              <span className="material-symbols-outlined">wb_sunny</span>
              <div>
                <h3>Condiciones Ambientales</h3>
              </div>
            </div>
            <div className="card-content">
              <label className="field-label">Nivel de Sol predominante</label>
              <SunlightChips
                value={form.sunlight}
                onChange={(value) => onFormChange("sunlight", value)}
              />

              <label className="field-label" style={{ marginTop: "16px" }}>
                Ciudad o Comuna
              </label>
              <div className="location-input">
                <span className="material-symbols-outlined">location_on</span>
                <input
                  type="text"
                  placeholder="Ej. Providencia, Santiago"
                  disabled
                  style={{ opacity: 0.5 }}
                />
              </div>
              <p className="field-help">
                Usamos esto para recomendar plantas según tu zona climática.
              </p>
            </div>
          </div>

          <button type="submit" className="project-button">
            Siguiente
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>

        <div className="project-right">
          <div className="project-preview">
            <div className="preview-placeholder">
              <span className="material-symbols-outlined">architecture</span>
              <p>Visualización de tu terreno</p>
              <small>Ingresa las dimensiones para ver la escala</small>
            </div>
          </div>

          <div className="project-tip">
            <p className="tip-label">Tip Experto</p>
            <p className="tip-text">
              Las plantas bien espaciadas crecen más saludables. Considera el espacio disponible
              para que cada una pueda desarrollarse plenamente.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  suffix: string;
  value: number;
  min: number;
  step?: number;
  onChange: (value: number) => void;
}

function NumberField({ label, suffix, value, min, step = 0.5, onChange }: NumberFieldProps) {
  return (
    <div className="number-field">
      <label>{label}</label>
      <div className="number-input-wrapper">
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
        />
        <span className="suffix">{suffix}</span>
      </div>
    </div>
  );
}
