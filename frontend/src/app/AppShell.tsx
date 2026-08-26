import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import Lenis from "@studio-freight/lenis";
import type { SystemHealth } from "../features/planner/types";

interface AppShellProps {
  children: ReactNode;
  systemHealth: SystemHealth | null;
}

const navigation = [
  { to: "/proyecto", label: "Espacio", shortLabel: "1" },
  { to: "/plantas", label: "Plantas", shortLabel: "2" },
  { to: "/plan", label: "Mi plan", shortLabel: "3" },
];

export function AppShell({ children, systemHealth }: AppShellProps) {
  const online = systemHealth?.status === "ok";

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      syncTouch: false,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return (
    <div className="site-shell">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="Ir al inicio de Terralta">
          <span className="brand-symbol" aria-hidden="true">
            T
          </span>
          <span>
            <strong>Terralta</strong>
            <small>Landscape studio</small>
          </span>
        </Link>

        <nav className="desktop-navigation" aria-label="Pasos del proyecto">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="header-meta">
          <span className={online ? "service-state online" : "service-state"}>
            <span aria-hidden="true" />
            {online ? "Servicios activos" : "Conectando"}
          </span>
          <button className="profile-button" type="button" aria-label="Abrir perfil">
            MD
          </button>
        </div>
      </header>

      <main className="site-main">{children}</main>

      <nav className="mobile-navigation" aria-label="Pasos del proyecto">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          <span aria-hidden="true">⌂</span>
          Inicio
        </NavLink>
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <span aria-hidden="true">{item.shortLabel}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
