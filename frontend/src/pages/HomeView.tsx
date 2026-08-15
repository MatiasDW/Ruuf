import { Link } from "react-router-dom";
import type { PlanResult } from "../features/planner/types";

interface HomeViewProps {
  result: PlanResult | null;
  plantCount: number;
}

export function HomeView({ result, plantCount }: HomeViewProps) {
  return (
    <div className="home-view page-enter">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Anteproyectos de paisajismo residencial</p>
          <h1>Un jardín que se siente tuyo y funciona en el mundo real.</h1>
          <p className="hero-lead">
            Ingresa las medidas, elige las especies que te gustan y recibe una propuesta que
            considera espacio, compatibilidad, riego y costo mensual.
          </p>
          <div className="hero-actions">
            <Link className="button primary" to="/proyecto">
              Crear mi jardín
            </Link>
            <Link className="button quiet" to="/plan">
              Ver propuesta demo
            </Link>
          </div>
          <div className="trust-line" aria-label="Características del servicio">
            <span>Medidas en metros</span>
            <span>Catálogo para Chile</span>
            <span>Anteproyecto editable</span>
          </div>
        </div>

        <div className="hero-visual" aria-label="Vista previa de un jardín planificado">
          <div className="sun-disc" />
          <div className="preview-plan">
            <div className="preview-plan-header">
              <span>Patio Los Aromos</span>
              <strong>{result?.summary.fits ? "Todo cabe" : "Propuesta inicial"}</strong>
            </div>
            <div className="preview-yard">
              <div className="preview-house">Casa</div>
              <div className="preview-path" />
              <span className="preview-tree tree-one">Q</span>
              <span className="preview-tree tree-two">O</span>
              <span className="preview-tree tree-three">J</span>
              <span className="preview-bed">Lavandas</span>
            </div>
            <div className="preview-metrics">
              <div>
                <span>Catálogo</span>
                <strong>{plantCount || 8} especies</strong>
              </div>
              <div>
                <span>Consumo estimado</span>
                <strong>{(result?.irrigation.monthly_m3 ?? 1.1).toFixed(1)} m³/mes</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="process-section" aria-labelledby="process-title">
        <div className="section-intro">
          <p className="eyebrow">Simple por fuera, riguroso por dentro</p>
          <h2 id="process-title">De una idea a un plano explicable.</h2>
        </div>
        <div className="process-grid">
          <article>
            <span>01</span>
            <h3>Describe el espacio</h3>
            <p>Medidas generales, casa, sol y estilo. No pedimos datos técnicos innecesarios.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Arma tu selección</h3>
            <p>Elige árboles y plantas; te mostramos espacio vital y demanda de agua.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Revisa la propuesta</h3>
            <p>Entiende qué cabe, qué conviene reemplazar y cuánto riego requiere.</p>
          </article>
        </div>
      </section>
    </div>
  );
}
