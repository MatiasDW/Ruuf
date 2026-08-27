import { useState, type FormEvent } from "react";
import type { PersistenceView, SaveStatus } from "./types";

interface SaveBarProps {
  persistence: PersistenceView;
  canSave: boolean;
  onSignIn: (email: string, password: string) => Promise<boolean>;
  onSave: () => Promise<void>;
  onReloadRevision: (discardLocalEdit: boolean) => Promise<void>;
}

const statusLabels: Record<SaveStatus, string> = {
  anonymous: "Sin sesión",
  unsaved: "Sin guardar",
  saving: "Guardando…",
  saved: "Guardado",
  conflict: "Conflicto de versión",
  error: "Error al guardar",
};

export function SaveBar({
  persistence,
  canSave,
  onSignIn,
  onSave,
  onReloadRevision,
}: SaveBarProps) {
  const [email, setEmail] = useState(import.meta.env.VITE_DEMO_USER_EMAIL ?? "");
  const [password, setPassword] = useState("");
  const { status } = persistence;
  const revisionLabel = persistence.revision ? ` · revisión ${persistence.revision}` : "";

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const signedIn = await onSignIn(email, password);
    if (signedIn) {
      setPassword("");
    }
  }

  return (
    <section className="save-bar" aria-label="Guardado del plan">
      <p className={`save-status save-${status}`} data-testid="save-status" role="status">
        <span aria-hidden="true" />
        {statusLabels[status]}
        {status === "saved" || status === "unsaved" ? revisionLabel : ""}
      </p>

      {status === "anonymous" ? (
        <details className="save-login-disclosure">
          <summary>Iniciar sesión para guardar</summary>
          <form className="save-login" onSubmit={handleSignIn} data-testid="save-login">
            <label>
              <span>Correo</span>
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
              />
            </label>
            <label>
              <span>Clave</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
              />
            </label>
            <button className="button quiet" type="submit" disabled={persistence.busy}>
              {persistence.busy ? "Entrando…" : "Iniciar sesión"}
            </button>
          </form>
        </details>
      ) : (
        <div className="save-actions">
          <span className="save-account">{persistence.email}</span>
          <button
            className="button primary"
            type="button"
            data-testid="save-plan"
            disabled={!canSave || status === "saving" || persistence.busy}
            onClick={() => void onSave()}
          >
            Guardar plan
          </button>
        </div>
      )}

      {status === "conflict" ? (
        <div className="save-conflict" role="alert" data-testid="save-conflict">
          <strong>
            Otra sesión guardó la revisión {persistence.conflictRevision}. Tu edición local sigue en
            pantalla.
          </strong>
          <div className="save-conflict-actions">
            <button
              className="button quiet"
              type="button"
              data-testid="reload-keep-local"
              disabled={persistence.busy}
              onClick={() => void onReloadRevision(false)}
            >
              Recargar y conservar mi edición
            </button>
            <button
              className="button quiet"
              type="button"
              data-testid="reload-discard-local"
              disabled={persistence.busy}
              onClick={() => void onReloadRevision(true)}
            >
              Usar la revisión guardada
            </button>
          </div>
        </div>
      ) : null}

      {persistence.message ? (
        <p className="save-message" data-testid="save-message">
          {persistence.message}
        </p>
      ) : null}
    </section>
  );
}
