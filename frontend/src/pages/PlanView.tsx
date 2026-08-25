import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { issueLabel, validatePlacements } from "../features/planner/editor";
import { GardenMap, type GardenSelection } from "../features/planner/GardenMap";
import {
  buildLegendItems,
  formatCurrency,
  formatIssueReason,
  highestWaterNeed,
  waterLabels,
} from "../features/planner/model";
import { SaveBar } from "../features/planner/SaveBar";
import type {
  FilterMode,
  HouseFormFields,
  PersistenceView,
  Placement,
  PlanResult,
  PlannerForm,
  UnplacedItem,
} from "../features/planner/types";

interface PlanViewProps {
  form: PlannerForm;
  result: PlanResult | null;
  loading: boolean;
  error: string;
  canUndo: boolean;
  canRedo: boolean;
  persistence: PersistenceView;
  onSignIn: (email: string, password: string) => Promise<boolean>;
  onSave: () => Promise<void>;
  onReloadRevision: (discardLocalEdit: boolean) => Promise<void>;
  onEditorGestureStart: () => void;
  onEditorGestureCommit: () => void;
  onEditorGestureCancel: () => void;
  onHouseChange: (house: HouseFormFields) => void;
  onHousePreview: (house: HouseFormFields) => void;
  onPlacementChange: (index: number, placement: Placement) => void;
  onPlacementPreview: (index: number, placement: Placement) => void;
  onReplaceConflict: (item: UnplacedItem) => Promise<void>;
  onUndo: () => void;
  onRedo: () => void;
}

export function PlanView({
  form,
  result,
  loading,
  error,
  canUndo,
  canRedo,
  persistence,
  onSignIn,
  onSave,
  onReloadRevision,
  onEditorGestureStart,
  onEditorGestureCommit,
  onEditorGestureCancel,
  onHouseChange,
  onHousePreview,
  onPlacementChange,
  onPlacementPreview,
  onReplaceConflict,
  onUndo,
  onRedo,
}: PlanViewProps) {
  const [filterMode, setFilterMode] = useState<FilterMode>("type");
  const [zoom, setZoom] = useState(1);
  const [selection, setSelection] = useState<GardenSelection>(null);
  const placements = result?.placements ?? [];
  const validations = validatePlacements(placements, form);
  const editorConflicts = validations.filter((validation) => !validation.valid);
  const groupedIssues = groupIssues(result?.unplaced ?? []);
  const totalIssues = groupedIssues.length + editorConflicts.length;
  const selectedPlacement = selection?.kind === "plant" ? placements[selection.index] : undefined;
  const selectedValidation = selection?.kind === "plant" ? validations[selection.index] : undefined;
  const legendItems = buildLegendItems(filterMode);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      const target = event.target;
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (event.key.toLowerCase() !== "z") {
        return;
      }
      event.preventDefault();
      if (event.shiftKey) {
        if (canRedo) {
          onRedo();
        }
        return;
      }
      if (canUndo) {
        onUndo();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [canRedo, canUndo, onRedo, onUndo]);

  return (
    <div className="plan-view technical-plan page-enter">
      <header className="plan-heading technical-heading">
        <div>
          <p className="eyebrow">Planificación técnica · Borrador editable</p>
          <h1>Plano editable del jardín</h1>
          <p>Arrastra, revisa interferencias y alterna la red de riego antes de confirmar.</p>
        </div>
        <div className="plan-heading-actions">
          <Link className="button quiet" to="/plantas">
            Editar plantas
          </Link>
          <span className={totalIssues ? "fit-badge" : "fit-badge ready"}>
            {totalIssues ? `${totalIssues} ajustes` : "Sin conflictos"}
          </span>
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}

      <SaveBar
        persistence={persistence}
        canSave={Boolean(result)}
        onSignIn={onSignIn}
        onSave={onSave}
        onReloadRevision={onReloadRevision}
      />

      <div className="plan-workspace technical-workspace">
        <section className="map-panel technical-map-panel" aria-labelledby="map-title">
          <div className="map-panel-header technical-map-header">
            <div>
              <span>Mi propiedad · Escala métrica</span>
              <h2 id="map-title">
                {form.yard_width} × {form.yard_height} m
              </h2>
            </div>
            <div className="map-actions">
              <div className="history-control" role="group" aria-label="Historial del editor">
                <button
                  type="button"
                  aria-label="Deshacer cambio del editor"
                  aria-keyshortcuts="Meta+Z Control+Z"
                  disabled={!canUndo}
                  onClick={onUndo}
                >
                  Deshacer
                </button>
                <button
                  type="button"
                  aria-label="Rehacer cambio del editor"
                  aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z"
                  disabled={!canRedo}
                  onClick={onRedo}
                >
                  Rehacer
                </button>
              </div>
              <div className="segmented-control" aria-label="Capa visible">
                <button
                  className={filterMode === "type" ? "active" : ""}
                  type="button"
                  onClick={() => setFilterMode("type")}
                >
                  Diseño
                </button>
                <button
                  className={filterMode === "water" ? "active water-active" : ""}
                  type="button"
                  onClick={() => setFilterMode("water")}
                >
                  Riego
                </button>
              </div>
              <div className="zoom-control">
                <button
                  type="button"
                  aria-label="Alejar plano"
                  onClick={() => setZoom((current) => Math.max(0.8, current - 0.2))}
                >
                  −
                </button>
                <button type="button" aria-label="Restablecer zoom" onClick={() => setZoom(1)}>
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  aria-label="Acercar plano"
                  onClick={() => setZoom((current) => Math.min(1.8, current + 0.2))}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div
            className="map-canvas technical-canvas"
            style={
              {
                "--yard-aspect": `${form.yard_width} / ${form.yard_height}`,
              } as CSSProperties
            }
          >
            {result ? (
              <GardenMap
                form={form}
                placements={placements}
                filterMode={filterMode}
                zoom={zoom}
                selection={selection}
                onSelectionChange={setSelection}
                onEditorGestureStart={onEditorGestureStart}
                onEditorGestureCommit={onEditorGestureCommit}
                onEditorGestureCancel={onEditorGestureCancel}
                onHousePreview={onHousePreview}
                onPlacementChange={onPlacementChange}
                onPlacementPreview={onPlacementPreview}
              />
            ) : (
              <div className="map-loading">
                {loading ? "Construyendo propuesta..." : "Todavía no hay un plano"}
              </div>
            )}
          </div>

          <div className="map-footer technical-map-footer">
            {filterMode === "water" ? (
              <div className="legend-list irrigation-legend">
                <span>
                  <i className="pipe-swatch main" />
                  Tubería principal
                </span>
                <span>
                  <i className="pipe-swatch branch" />
                  Ramales
                </span>
                <span>
                  <i className="coverage-swatch" />
                  Alcance estimado
                </span>
              </div>
            ) : (
              <div className="legend-list">
                {legendItems.map((item) => (
                  <span key={item.label}>
                    <i
                      className={item.swatchClass ?? "legend-swatch"}
                      style={item.color ? { backgroundColor: item.color } : undefined}
                    />
                    {item.label}
                  </span>
                ))}
              </div>
            )}
            <p>
              {filterMode === "water"
                ? "Trazado L1 referencial: un especialista debe definir presión, diámetros y emisores."
                : "Los anillos son radios mínimos. Rojo significa que la ubicación necesita corrección."}
            </p>
          </div>
        </section>

        <aside className="plan-sidebar technical-sidebar">
          <EditorInspector
            form={form}
            filterMode={filterMode}
            selection={selection}
            placement={selectedPlacement}
            validation={selectedValidation}
            conflictCount={editorConflicts.length}
            onHouseChange={onHouseChange}
            onPlacementChange={(placement) => {
              if (selection?.kind === "plant") {
                onPlacementChange(selection.index, placement);
              }
            }}
          />

          <section className="summary-card dark-card plan-overview-card">
            <div className="overview-card-heading">
              <p className="eyebrow">Resumen del plan</p>
              <span aria-hidden="true">↗</span>
            </div>
            <div className="summary-primary">
              <span>Estimación mensual</span>
              <strong>{formatCurrency(result?.irrigation.monthly_total_cost_clp ?? 0)}</strong>
            </div>
            <dl className="summary-metrics">
              <div>
                <dt>Ubicadas</dt>
                <dd>{placements.length}</dd>
              </div>
              <div>
                <dt>Solicitadas</dt>
                <dd>{result?.summary.requested_items ?? 0}</dd>
              </div>
              <div>
                <dt>Agua/mes</dt>
                <dd>{(result?.irrigation.monthly_m3 ?? 0).toFixed(2)} m³</dd>
              </div>
              <div>
                <dt>Demanda</dt>
                <dd>{waterLabels[highestWaterNeed(result)]}</dd>
              </div>
            </dl>
          </section>

          <section className="summary-card recommendation-card">
            <div className="sidebar-heading">
              <div>
                <p className="eyebrow">Asistente técnico</p>
                <h2>{groupedIssues.length ? "Decisiones pendientes" : "Selección compatible"}</h2>
              </div>
              <span>{groupedIssues.length}</span>
            </div>
            <div className="recommendation-list">
              {groupedIssues.length ? (
                groupedIssues.map(({ item, count }) => (
                  <article key={`${item.name}-${item.reason}`}>
                    <strong>
                      {item.name} {count > 1 ? `× ${count}` : ""}
                    </strong>
                    <p>{formatIssueReason(item.reason)}</p>
                    {item.suggestions.length ? (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void onReplaceConflict(item)}
                      >
                        Usar {item.suggestions[0]}
                      </button>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="empty-state">
                  El motor ubicó las especies solicitadas. Ajusta manualmente el plano si quieres
                  probar otra composición.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>

      <div className="plan-disclaimer">
        <strong>Anteproyecto L1</strong>
        <span>
          Las coberturas de riego, cañerías y geometrías deben validarse en terreno antes de
          construir.
        </span>
      </div>
    </div>
  );
}

interface EditorInspectorProps {
  form: PlannerForm;
  filterMode: FilterMode;
  selection: GardenSelection;
  placement?: Placement;
  validation?: ReturnType<typeof validatePlacements>[number];
  conflictCount: number;
  onHouseChange: (house: HouseFormFields) => void;
  onPlacementChange: (placement: Placement) => void;
}

function EditorInspector({
  form,
  filterMode,
  selection,
  placement,
  validation,
  conflictCount,
  onHouseChange,
  onPlacementChange,
}: EditorInspectorProps) {
  if (selection?.kind === "house") {
    return (
      <section className="summary-card editor-inspector selected-inspector">
        <div className="inspector-title">
          <span className="selection-icon house-icon" aria-hidden="true">
            ⌂
          </span>
          <div>
            <p className="eyebrow">Elemento seleccionado</p>
            <h2>Casa</h2>
          </div>
        </div>
        <p className="inspector-help">
          Arrastra la huella o sus cuatro esquinas directamente en el plano.
        </p>
        <div className="shape-selector compact" role="group" aria-label="Forma de la casa">
          <button
            className={form.house_shape === "rectangle" ? "active" : ""}
            type="button"
            onClick={() => onHouseChange({ ...pickHouse(form), house_shape: "rectangle" })}
          >
            Rectangular
          </button>
          <button
            className={form.house_shape === "l_shape" ? "active" : ""}
            type="button"
            onClick={() => onHouseChange({ ...pickHouse(form), house_shape: "l_shape" })}
          >
            En L
          </button>
        </div>
        <div className="inspector-fields">
          <InspectorNumber
            label="Ancho"
            value={form.obstacle_width}
            onChange={(value) => onHouseChange({ ...pickHouse(form), obstacle_width: value })}
          />
          <InspectorNumber
            label="Largo"
            value={form.obstacle_height}
            onChange={(value) => onHouseChange({ ...pickHouse(form), obstacle_height: value })}
          />
          <InspectorNumber
            label="Desde izq."
            value={form.obstacle_x}
            onChange={(value) => onHouseChange({ ...pickHouse(form), obstacle_x: value })}
          />
          <InspectorNumber
            label="Desde arriba"
            value={form.obstacle_y}
            onChange={(value) => onHouseChange({ ...pickHouse(form), obstacle_y: value })}
          />
        </div>
      </section>
    );
  }

  if (selection?.kind === "plant" && placement) {
    return (
      <section
        className={`summary-card editor-inspector selected-inspector ${validation?.valid ? "" : "inspector-conflict"}`}
      >
        <div className="inspector-title">
          <span className="selection-icon plant-icon" aria-hidden="true">
            ✦
          </span>
          <div>
            <p className="eyebrow">Planta seleccionada</p>
            <h2>{placement.name}</h2>
          </div>
        </div>
        <div className="inspector-fields two-fields">
          <InspectorNumber
            label="Posición X"
            value={placement.x}
            onChange={(x) => onPlacementChange({ ...placement, x })}
          />
          <InspectorNumber
            label="Posición Y"
            value={placement.y}
            onChange={(y) => onPlacementChange({ ...placement, y })}
          />
        </div>
        <dl className="selection-facts">
          <div>
            <dt>Radio mínimo</dt>
            <dd>{placement.clearance_radius_m} m</dd>
          </div>
          <div>
            <dt>Riego</dt>
            <dd>{waterLabels[placement.water_need]}</dd>
          </div>
        </dl>
        {validation?.issues.length ? (
          <div className="inline-conflicts" role="status">
            <strong>Corrige esta ubicación</strong>
            {validation.issues.map((issue) => (
              <span key={issue}>{issueLabel(issue)}</span>
            ))}
          </div>
        ) : (
          <p className="valid-placement">
            Ubicación válida. También puedes moverla con las flechas del teclado.
          </p>
        )}
      </section>
    );
  }

  return (
    <section
      className={`summary-card editor-inspector mode-inspector ${filterMode === "water" ? "water-inspector" : ""}`}
    >
      <div className="inspector-title">
        <span className="selection-icon" aria-hidden="true">
          {filterMode === "water" ? "≈" : "✥"}
        </span>
        <div>
          <p className="eyebrow">{filterMode === "water" ? "Capa hidráulica" : "Editor técnico"}</p>
          <h2>{filterMode === "water" ? "Red de riego L1" : "Selecciona un elemento"}</h2>
        </div>
      </div>
      <p className="inspector-help">
        {filterMode === "water"
          ? "Las líneas muestran tuberías sugeridas por demanda y los círculos azules, alcance aproximado."
          : "Haz clic en la casa o una planta para editar medidas, forma y posición."}
      </p>
      <div className={conflictCount ? "editor-health has-errors" : "editor-health"}>
        <span aria-hidden="true" />
        {conflictCount
          ? `${conflictCount} elementos con interferencias`
          : "Geometría sin interferencias"}
      </div>
    </section>
  );
}

function InspectorNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <span>
        <input
          type="number"
          min="0"
          step="0.25"
          value={value}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
        />{" "}
        m
      </span>
    </label>
  );
}

function groupIssues(items: UnplacedItem[]): Array<{ item: UnplacedItem; count: number }> {
  const grouped = new Map<string, { item: UnplacedItem; count: number }>();
  for (const item of items) {
    const key = `${item.name}:${item.reason}`;
    const existing = grouped.get(key);
    grouped.set(key, existing ? { ...existing, count: existing.count + 1 } : { item, count: 1 });
  }
  return [...grouped.values()];
}

function pickHouse(form: PlannerForm): HouseFormFields {
  return {
    obstacle_width: form.obstacle_width,
    obstacle_height: form.obstacle_height,
    obstacle_x: form.obstacle_x,
    obstacle_y: form.obstacle_y,
    house_shape: form.house_shape,
  };
}
