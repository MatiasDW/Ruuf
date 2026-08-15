import { useState } from "react";
import { Link } from "react-router-dom";
import { GardenMap } from "../features/planner/GardenMap";
import {
  buildLegendItems,
  formatCurrency,
  formatIssueReason,
  highestWaterNeed,
  waterLabels,
} from "../features/planner/model";
import type {
  FilterMode,
  PlanResult,
  PlannerForm,
  Plant,
  UnplacedItem,
} from "../features/planner/types";

interface PlanViewProps {
  form: PlannerForm;
  plants: Plant[];
  result: PlanResult | null;
  loading: boolean;
  error: string;
  onReplaceConflict: (item: UnplacedItem) => Promise<void>;
}

export function PlanView({
  form,
  plants,
  result,
  loading,
  error,
  onReplaceConflict,
}: PlanViewProps) {
  const [filterMode, setFilterMode] = useState<FilterMode>("type");
  const [zoom, setZoom] = useState(1);
  const legendItems = buildLegendItems(filterMode);
  const groupedIssues = groupIssues(result?.unplaced ?? []);

  return (
    <div className="plan-view page-enter">
      <header className="plan-heading">
        <div>
          <p className="eyebrow">Paso 3 de 3 · Anteproyecto</p>
          <h1>Tu jardín, organizado con criterios reales.</h1>
          <p>Explora la propuesta y revisa las decisiones antes de continuar con un profesional.</p>
        </div>
        <div className="plan-heading-actions">
          <Link className="button quiet" to="/plantas">
            Editar selección
          </Link>
          <span className={result?.summary.fits ? "fit-badge ready" : "fit-badge"}>
            {result?.summary.fits ? "Propuesta compatible" : "Requiere ajustes"}
          </span>
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="plan-workspace">
        <section className="map-panel" aria-labelledby="map-title">
          <div className="map-panel-header">
            <div>
              <span>Plano a escala</span>
              <h2 id="map-title">
                {form.yard_width} × {form.yard_height} metros
              </h2>
            </div>
            <div className="map-actions">
              <div className="segmented-control" aria-label="Colorear el plano por">
                <button
                  className={filterMode === "type" ? "active" : ""}
                  type="button"
                  onClick={() => setFilterMode("type")}
                >
                  Tipo
                </button>
                <button
                  className={filterMode === "water" ? "active" : ""}
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
                <span>{Math.round(zoom * 100)}%</span>
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

          <div className="map-canvas">
            {result ? (
              <GardenMap form={form} result={result} filterMode={filterMode} zoom={zoom} />
            ) : (
              <div className="map-loading">
                {loading ? "Construyendo propuesta..." : "Sin plano"}
              </div>
            )}
          </div>

          <div className="map-footer">
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
            <p>Los círculos muestran el espacio mínimo recomendado para cada planta.</p>
          </div>
        </section>

        <aside className="plan-sidebar">
          <section className="summary-card dark-card">
            <p className="eyebrow">Resumen</p>
            <div className="summary-primary">
              <span>Estimación mensual</span>
              <strong>{formatCurrency(result?.irrigation.monthly_total_cost_clp ?? 0)}</strong>
            </div>
            <dl className="summary-metrics">
              <div>
                <dt>Ubicadas</dt>
                <dd>{result?.summary.placed_items ?? 0}</dd>
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
                <dt>Riego</dt>
                <dd>{waterLabels[highestWaterNeed(result)]}</dd>
              </div>
            </dl>
          </section>

          <section className="summary-card">
            <div className="sidebar-heading">
              <div>
                <p className="eyebrow">Recomendaciones</p>
                <h2>{groupedIssues.length ? "Decisiones pendientes" : "Todo en orden"}</h2>
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
                  Las {result?.summary.placed_items ?? 0} plantas respetan las condiciones actuales.
                </p>
              )}
            </div>
          </section>

          <section className="summary-card compact-card">
            <p className="eyebrow">Catálogo considerado</p>
            <div className="catalog-names">
              {plants.slice(0, 6).map((plant) => (
                <span key={plant.id}>{plant.name}</span>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <div className="plan-disclaimer">
        <strong>Resultado de nivel L1</strong>
        <span>
          Es una propuesta comercial preliminar. Riego, suelo, instalaciones y medidas deben ser
          revisados antes de construir.
        </span>
      </div>
    </div>
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
