import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { issueLabel, validatePlacements } from "../features/planner/editor";
import { GardenMap, type GardenSelection } from "../features/planner/GardenMap";
import {
  fetchIrrigationNetwork,
  loadLocalIrrigationDraft,
  saveIrrigationNetwork,
  saveLocalIrrigationDraft,
} from "../features/planner/irrigation-network";
import {
  formatCurrency,
  formatIssueReason,
  highestWaterNeed,
  waterLabels,
} from "../features/planner/model";
import { SaveBar } from "../features/planner/SaveBar";
import { IrrigationEditor } from "../features/planner/IrrigationEditor";
import { HouseInspector } from "../features/planner/HouseInspector";
import { UnifiedToolsPanel } from "../features/planner/UnifiedToolsPanel";
import { PlanSummary } from "../features/planner/PlanSummary";
import { UnplacedSuggestions } from "../features/planner/UnplacedSuggestions";
import type {
  FilterMode,
  HouseFormFields,
  IrrigationEditorState,
  IrrigationNetworkDesign,
  LawnZone,
  PersistenceView,
  Placement,
  PlanResult,
  PlannerForm,
  SiteElement,
  UnplacedItem,
  WaterNeed,
} from "../features/planner/types";

interface PlanViewProps {
  form: PlannerForm;
  result: PlanResult | null;
  loading: boolean;
  error: string;
  canUndo: boolean;
  canRedo: boolean;
  persistence: PersistenceView;
  irrigationEditor: IrrigationEditorState;
  lawnZones: LawnZone[];
  lawnZoneDrawMode: boolean;
  selectedLawnZoneId: string | null;
  siteElements: SiteElement[];
  onSignIn: (email: string, password: string) => Promise<boolean>;
  onSave: () => Promise<void>;
  onReloadRevision: (discardLocalEdit: boolean) => Promise<void>;
  onSetLawnZones: (zones: LawnZone[]) => void;
  onSetLawnZoneDrawMode: (mode: boolean) => void;
  onSetSelectedLawnZoneId: (id: string | null) => void;
  onSetSiteElements: (elements: SiteElement[]) => void;
  onEditorGestureStart: () => void;
  onEditorGestureCommit: () => void;
  onEditorGestureCancel: () => void;
  onHouseChange: (house: HouseFormFields) => void;
  onHousePreview: (house: HouseFormFields) => void;
  onPlacementChange: (index: number, placement: Placement) => void;
  onPlacementPreview: (index: number, placement: Placement) => void;
  onReplaceConflict: (item: UnplacedItem) => Promise<void>;
  onSetIrrigationEditor: (state: IrrigationEditorState) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function PlanView({
  form,
  result,
  loading,
  error,
  irrigationEditor,
  onSetIrrigationEditor,
  lawnZones,
  lawnZoneDrawMode,
  selectedLawnZoneId,
  siteElements,
  onSetLawnZones,
  onSetLawnZoneDrawMode,
  onSetSelectedLawnZoneId,
  onSetSiteElements,
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
  const selectedLawnZone =
    selection?.kind === "lawn" ? lawnZones.find((z) => z.id === selection.id) : undefined;

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

  // Hidrata el editor desde el diseño guardado una sola vez por origen (layout de la
  // API con sesión, o el borrador local del navegador sin sesión); sin este guard el
  // efecto pisaría lo que el usuario está editando en cada re-render.
  const hydratedNetworkLayout = useRef<string | null>(null);
  useEffect(() => {
    if (filterMode !== "water") {
      return;
    }
    const sourceKey = persistence.layoutId ?? "local";
    if (hydratedNetworkLayout.current === sourceKey) {
      return;
    }
    hydratedNetworkLayout.current = sourceKey;

    function adoptDesign(design: IrrigationNetworkDesign) {
      onSetIrrigationEditor({
        sourceX: design.water_source_x,
        sourceY: design.water_source_y,
        waterSourceType: design.water_source_type,
        pipeRoute: design.main_pipe_route,
        numPipes: (design.num_main_pipes as 1 | 2 | 3 | 4) || 1,
        isEditing: false,
        isDirty: false,
        isSaving: false,
      });
    }

    if (!persistence.layoutId) {
      const draft = loadLocalIrrigationDraft();
      if (draft) adoptDesign(draft);
      return;
    }
    fetchIrrigationNetwork(persistence.layoutId)
      .then((design) => {
        if (design) adoptDesign(design);
      })
      .catch(() => {
        // Layout sin diseño de red guardado: el editor parte con los valores por defecto.
      });
  }, [filterMode, persistence.layoutId, onSetIrrigationEditor]);

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
                irrigationState={irrigationEditor}
                lawnZones={lawnZones}
                lawnZoneDrawMode={lawnZoneDrawMode}
                selectedLawnZoneId={selectedLawnZoneId}
                siteElements={siteElements}
                onSelectionChange={setSelection}
                onEditorGestureStart={onEditorGestureStart}
                onEditorGestureCommit={onEditorGestureCommit}
                onEditorGestureCancel={onEditorGestureCancel}
                onHouseChange={onHouseChange}
                onHousePreview={onHousePreview}
                onPlacementChange={onPlacementChange}
                onPlacementPreview={onPlacementPreview}
                onSetLawnZones={onSetLawnZones}
                onSetLawnZoneDrawMode={onSetLawnZoneDrawMode}
                onSetSelectedLawnZoneId={onSetSelectedLawnZoneId}
                onSetSiteElements={onSetSiteElements}
                onIrrigationStateChange={(partial) =>
                  onSetIrrigationEditor({ ...irrigationEditor, ...partial })
                }
              />
            ) : (
              <div className="map-loading">
                {loading ? "Construyendo propuesta..." : "Todavía no hay un plano"}
              </div>
            )}

            <div className="map-zoom-overlay" role="group" aria-label="Zoom del plano">
              <button
                type="button"
                aria-label="Acercar plano"
                onClick={() => setZoom((current) => Math.min(1.8, current + 0.2))}
              >
                +
              </button>
              <button type="button" aria-label="Restablecer zoom" onClick={() => setZoom(1)}>
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                aria-label="Alejar plano"
                onClick={() => setZoom((current) => Math.max(0.8, current - 0.2))}
              >
                −
              </button>
            </div>
          </div>
        </section>

        <aside className="plan-sidebar technical-sidebar">
          {filterMode === "water" && irrigationEditor.isEditing ? (
            <IrrigationEditor
              state={irrigationEditor}
              yardWidth={form.yard_width}
              yardHeight={form.yard_height}
              persistenceScope={persistence.layoutId && persistence.email ? "cloud" : "local"}
              onStateChange={(partial) =>
                onSetIrrigationEditor({ ...irrigationEditor, ...partial })
              }
              onSave={async () => {
                const design = {
                  water_source_x: irrigationEditor.sourceX,
                  water_source_y: irrigationEditor.sourceY,
                  water_source_type: irrigationEditor.waterSourceType,
                  main_pipe_route: irrigationEditor.pipeRoute,
                  num_main_pipes: irrigationEditor.numPipes,
                };
                if (persistence.layoutId && persistence.email) {
                  await saveIrrigationNetwork(persistence.layoutId, design);
                  return;
                }
                saveLocalIrrigationDraft(design);
              }}
            />
          ) : (
            <EditorInspector
              form={form}
              filterMode={filterMode}
              selection={selection}
              placement={selectedPlacement}
              validation={selectedValidation}
              lawnZone={selectedLawnZone}
              conflictCount={editorConflicts.length}
              onHouseChange={onHouseChange}
              onPlacementChange={(placement) => {
                if (selection?.kind === "plant") {
                  onPlacementChange(selection.index, placement);
                }
              }}
              onLawnZoneChange={(zone) =>
                onSetLawnZones(lawnZones.map((z) => (z.id === zone.id ? zone : z)))
              }
              onDeleteLawnZone={(id) => {
                onSetLawnZones(lawnZones.filter((z) => z.id !== id));
                onSetSelectedLawnZoneId(null);
              }}
            />
          )}

          {filterMode !== "water" && (
          <UnifiedToolsPanel
            lawnZoneDrawMode={lawnZoneDrawMode}
            onSetLawnZoneDrawMode={onSetLawnZoneDrawMode}
            onAddElement={(type) => {
              const newId = `elem-${Date.now()}`;
              const newElement: SiteElement = {
                id: newId,
                feature_type: type,
                x: 5,
                y: 5,
                width: 2,
                height: 2,
              };
              onSetSiteElements([...siteElements, newElement]);
            }}
          />
          )}

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
                <dd>
                  {(result?.irrigation.monthly_m3 ?? 0).toFixed(2)} m³
                  {lawnZones.length > 0 && <span className="summary-note"> (incluye césped)</span>}
                </dd>
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

          <PlanSummary
            placedCount={placements.length}
            requestedCount={result?.summary.requested_items ?? 0}
            weeklyLiters={Math.round(result?.irrigation.weekly_liters ?? 0)}
            monthlyCostCLP={result?.irrigation.monthly_total_cost_clp ?? 0}
          />

          <UnplacedSuggestions
            unplaced={result?.unplaced ?? []}
            onReplace={() => {
              // Replace action handled via recommendation-card above
            }}
            onRemove={() => {
              // Remove action would require filtering from placements
            }}
          />

          <div style={{ padding: "16px", display: "flex", gap: "8px", flexDirection: "column" }}>
            <button
              type="button"
              disabled
              title="Próximamente"
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                backgroundColor: "#e6e9e7",
                color: "rgba(0, 0, 0, 0.6)",
                border: "none",
                cursor: "not-allowed",
              }}
            >
              Descargar PDF
            </button>
            <a
              href="mailto:contacto@ruuf.cl"
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                backgroundColor: "#163422",
                color: "white",
                textDecoration: "none",
                textAlign: "center",
                fontWeight: "600",
              }}
            >
              Solicitar Asesoría
            </a>
          </div>
        </aside>
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
  lawnZone?: LawnZone;
  conflictCount: number;
  onHouseChange: (house: HouseFormFields) => void;
  onPlacementChange: (placement: Placement) => void;
  onLawnZoneChange: (zone: LawnZone) => void;
  onDeleteLawnZone: (id: string) => void;
}

function EditorInspector({
  form,
  filterMode,
  selection,
  placement,
  validation,
  lawnZone,
  conflictCount,
  onHouseChange,
  onPlacementChange,
  onLawnZoneChange,
  onDeleteLawnZone,
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
          Arrastra la huella o sus vértices directamente en el plano. Doble-click en una arista para
          insertar vértice.
        </p>
        <HouseInspector form={form} onHouseChange={onHouseChange} />
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

  if (selection?.kind === "lawn" && lawnZone) {
    return (
      <section className="summary-card editor-inspector selected-inspector">
        <div className="inspector-title">
          <span className="selection-icon" aria-hidden="true">
            🌿
          </span>
          <div>
            <p className="eyebrow">Zona seleccionada</p>
            <h2>Césped</h2>
          </div>
        </div>
        <p className="inspector-help">
          Arrastra para mover. Esquinas para redimensionar. Supr para eliminar.
        </p>
        <div className="inspector-fields two-fields">
          <InspectorNumber
            label="X"
            value={lawnZone.x}
            onChange={(x) => onLawnZoneChange({ ...lawnZone, x })}
          />
          <InspectorNumber
            label="Y"
            value={lawnZone.y}
            onChange={(y) => onLawnZoneChange({ ...lawnZone, y })}
          />
          <InspectorNumber
            label="Ancho"
            value={lawnZone.width}
            onChange={(width) => onLawnZoneChange({ ...lawnZone, width: Math.max(0.5, width) })}
          />
          <InspectorNumber
            label="Alto"
            value={lawnZone.height}
            onChange={(height) => onLawnZoneChange({ ...lawnZone, height: Math.max(0.5, height) })}
          />
        </div>
        <dl className="selection-facts">
          <div>
            <dt>Área</dt>
            <dd>{(lawnZone.width * lawnZone.height).toFixed(1)} m²</dd>
          </div>
          <div>
            <dt>Demanda</dt>
            <dd>
              <select
                value={lawnZone.water_need}
                onChange={(e) =>
                  onLawnZoneChange({ ...lawnZone, water_need: e.target.value as WaterNeed })
                }
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </dd>
          </div>
          <div>
            <dt>Especie</dt>
            <dd>
              <select
                value={lawnZone.liters_per_m2_week}
                onChange={(e) =>
                  onLawnZoneChange({ ...lawnZone, liters_per_m2_week: parseFloat(e.target.value) })
                }
              >
                <option value={8}>Festuca (8 L/m²·sem)</option>
                <option value={10}>Pasto inglés (10 L/m²·sem)</option>
                <option value={12}>Grama (12 L/m²·sem)</option>
              </select>
            </dd>
          </div>
        </dl>
        <button
          type="button"
          className="button quiet"
          style={{ marginTop: "12px", width: "100%" }}
          onClick={() => onDeleteLawnZone(lawnZone.id)}
        >
          Eliminar zona
        </button>
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
        ) : null}
      </section>
    );
  }

  if (filterMode === "water") {
    return conflictCount > 0 ? (
      <section className="summary-card editor-inspector mode-inspector water-inspector">
        <div className="editor-health has-errors">
          <span aria-hidden="true" />
          {`${conflictCount} elementos con interferencias`}
        </div>
      </section>
    ) : null;
  }

  return (
    <section className="summary-card editor-inspector mode-inspector">
      <div className="inspector-title">
        <span className="selection-icon" aria-hidden="true">
          ✥
        </span>
        <div>
          <p className="eyebrow">Editor técnico</p>
          <h2>Selecciona un elemento</h2>
        </div>
      </div>
      {conflictCount > 0 && (
        <div className="editor-health has-errors">
          <span aria-hidden="true" />
          {`${conflictCount} elementos con interferencias`}
        </div>
      )}
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
