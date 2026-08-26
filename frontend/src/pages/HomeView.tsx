import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import type { PlanResult } from "../features/planner/types";

interface HomeViewProps {
  result: PlanResult | null;
  plantCount: number;
}

export function HomeView({ result, plantCount }: HomeViewProps) {
  const heroVisualRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 300], [0, 50]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  return (
    <div className="home-view page-enter">
      <section className="hero-section">
        <motion.div
          className="hero-copy"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={containerVariants}
        >
          <motion.p className="eyebrow" variants={itemVariants}>
            Anteproyectos de paisajismo residencial
          </motion.p>
          <motion.h1 variants={itemVariants}>
            Un jardín que se siente tuyo y funciona en el mundo real.
          </motion.h1>
          <motion.p className="hero-lead" variants={itemVariants}>
            Ingresa las medidas, elige las especies que te gustan y recibe una propuesta que
            considera espacio, compatibilidad, riego y costo mensual.
          </motion.p>
          <motion.div className="hero-actions" variants={itemVariants}>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link className="button primary" to="/proyecto">
                Crear mi jardín
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link className="button quiet" to="/plan">
                Ver propuesta demo
              </Link>
            </motion.div>
          </motion.div>
          <motion.div
            className="trust-line"
            aria-label="Características del servicio"
            variants={itemVariants}
          >
            <span>Medidas en metros</span>
            <span>Catálogo para Chile</span>
            <span>Anteproyecto editable</span>
          </motion.div>
        </motion.div>

        <motion.div
          ref={heroVisualRef}
          className="hero-visual"
          aria-label="Vista previa de un jardín planificado"
          style={{ y: heroY }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
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
        </motion.div>
      </section>

      <motion.section
        className="process-section"
        aria-labelledby="process-title"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={containerVariants}
      >
        <div className="section-intro">
          <motion.p className="eyebrow" variants={itemVariants}>
            Simple por fuera, riguroso por dentro
          </motion.p>
          <motion.h2 id="process-title" variants={itemVariants}>
            De una idea a un plano explicable.
          </motion.h2>
        </div>
        <div className="process-grid">
          {[
            {
              num: "01",
              title: "Describe el espacio",
              desc: "Medidas generales, casa, sol y estilo. No pedimos datos técnicos innecesarios.",
            },
            {
              num: "02",
              title: "Arma tu selección",
              desc: "Elige árboles y plantas; te mostramos espacio vital y demanda de agua.",
            },
            {
              num: "03",
              title: "Revisa la propuesta",
              desc: "Entiende qué cabe, qué conviene reemplazar y cuánto riego requiere.",
            },
          ].map((step, i) => (
            <motion.article key={i} variants={itemVariants}>
              <span>{step.num}</span>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </motion.article>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
