import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { styleOptions, sunlightOptions } from "../features/planner/model";
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
    <div className="workflow-view page-enter">
      <WorkflowHeading
        step="Paso 1 de 3"
        title="Cuéntanos cómo es el espacio."
        description="Con estas medidas podemos construir una primera geometría. Podrás corregirla antes de confirmar el anteproyecto."
      />

      <form className="project-form" onSubmit={continueToPlants}>
        <div className="form-sections">
          <section className="form-card featured-card">
            <div className="card-heading">
              <span className="card-number">01</span>
              <div>
                <h2>Terreno y ambiente</h2>
                <p>Las dimensiones útiles del patio, sin incluir el área construida.</p>
              </div>
            </div>
            <div className="field-grid two-columns">
              <NumberField
                label="Ancho del patio"
                suffix="m"
                value={form.yard_width}
                min={1}
                onChange={(value) => onFormChange("yard_width", value)}
              />
              <NumberField
                label="Largo del patio"
                suffix="m"
                value={form.yard_height}
                min={1}
                onChange={(value) => onFormChange("yard_height", value)}
              />
              <label className="field-control">
                <span>Exposición solar</span>
                <select
                  value={form.sunlight}
                  onChange={(event) =>
                    onFormChange("sunlight", event.currentTarget.value as PlannerForm["sunlight"])
                  }
                >
                  {sunlightOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-control">
                <span>Estilo buscado</span>
                <select
                  value={form.style}
                  onChange={(event) =>
                    onFormChange("style", event.currentTarget.value as PlannerForm["style"])
                  }
                >
                  {styleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="form-card">
            <div className="card-heading">
              <span className="card-number">02</span>
              <div>
                <h2>Huella de la casa</h2>
                <p>Ubicación aproximada dentro del terreno. No requiere un plano técnico.</p>
              </div>
            </div>
            <div className="field-grid four-columns">
              <NumberField
                label="Ancho"
                suffix="m"
                value={form.obstacle_width}
                min={0}
                onChange={(value) => onFormChange("obstacle_width", value)}
              />
              <NumberField
                label="Largo"
                suffix="m"
                value={form.obstacle_height}
                min={0}
                onChange={(value) => onFormChange("obstacle_height", value)}
              />
              <NumberField
                label="Distancia izquierda"
                suffix="m"
                value={form.obstacle_x}
                min={0}
                onChange={(value) => onFormChange("obstacle_x", value)}
              />
              <NumberField
                label="Distancia superior"
                suffix="m"
                value={form.obstacle_y}
                min={0}
                onChange={(value) => onFormChange("obstacle_y", value)}
              />
            </div>
          </section>

          <details className="form-card pricing-details">
            <summary>
              <span>
                <strong>Tarifa de agua</strong>
                <small>Opcional para mejorar la estimación mensual</small>
              </span>
              <span aria-hidden="true">+</span>
            </summary>
            <div className="field-grid two-columns details-content">
              <NumberField
                label="Cargo variable"
                suffix="CLP/m³"
                value={form.water_price_clp_per_m3}
                min={0}
                step={50}
                onChange={(value) => onFormChange("water_price_clp_per_m3", value)}
              />
              <NumberField
                label="Cargo fijo mensual"
                suffix="CLP"
                value={form.fixed_charge_clp}
                min={0}
                step={100}
                onChange={(value) => onFormChange("fixed_charge_clp", value)}
              />
            </div>
          </details>
        </div>

        <aside className="project-summary-card">
          <p className="eyebrow">Resumen del espacio</p>
          <div className="dimension-preview" aria-hidden="true">
            <span>{form.yard_width} m</span>
            <div className="dimension-house">Casa</div>
            <span>{form.yard_height} m</span>
          </div>
          <dl>
            <div>
              <dt>Área aproximada</dt>
              <dd>{(form.yard_width * form.yard_height).toFixed(0)} m²</dd>
            </div>
            <div>
              <dt>Área construida</dt>
              <dd>{(form.obstacle_width * form.obstacle_height).toFixed(0)} m²</dd>
            </div>
          </dl>
          <p className="summary-note">
            La propuesta será un anteproyecto. Un profesional debe validar instalaciones y medidas
            constructivas.
          </p>
        </aside>

        <div className="workflow-actions">
          <span>Los datos se mantienen mientras completas estos pasos.</span>
          <button className="button primary" type="submit">
            Continuar a plantas
          </button>
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
    <label className="field-control">
      <span>{label}</span>
      <span className="number-input">
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
        />
        <small>{suffix}</small>
      </span>
    </label>
  );
}

interface WorkflowHeadingProps {
  step: string;
  title: string;
  description: string;
}

export function WorkflowHeading({ step, title, description }: WorkflowHeadingProps) {
  return (
    <header className="workflow-heading">
      <p className="eyebrow">{step}</p>
      <h1>{title}</h1>
      <p>{description}</p>
      <div className="step-track" aria-label={step}>
        <span className="complete" />
        <span />
        <span />
      </div>
    </header>
  );
}
