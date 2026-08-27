interface PlanSummaryProps {
  placedCount: number;
  requestedCount: number;
  weeklyLiters: number;
  monthlyCostCLP: number;
}

export function PlanSummary({
  placedCount,
  requestedCount,
  weeklyLiters,
  monthlyCostCLP,
}: PlanSummaryProps) {
  const progressPercent = requestedCount > 0 ? Math.round((placedCount / requestedCount) * 100) : 0;

  return (
    <div className="plan-summary-section">
      <div className="summary-header">
        <h3>Resumen del Plan</h3>
        <span className="material-symbols-outlined info-icon">info</span>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        <span className="progress-text">{progressPercent}% de especies ubicadas</span>
      </div>

      <div className="summary-tiles">
        <div className="summary-tile">
          <p className="tile-label">Est. Hídrico</p>
          <p className="tile-value">{weeklyLiters}L/sem</p>
        </div>
        <div className="summary-tile">
          <p className="tile-label">Costo Mensual</p>
          <p className="tile-value">${monthlyCostCLP.toLocaleString("es-CL")}</p>
        </div>
      </div>
    </div>
  );
}
