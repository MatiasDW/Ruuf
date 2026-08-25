#!/usr/bin/env bash
# SEC-102 — Escaneo de secretos con gitleaks, siempre via Docker.
#
# No se instala nada en el host (misma politica que el resto del repo: las
# herramientas corren en contenedor). Todos los modos usan --redact, por lo que
# ningun valor de secreto se imprime ni se escribe en los reportes.
#
# Modos:
#   worktree           Escanea todo lo que Git puede commitear hoy (tracked +
#                      untracked no ignorados). Es el comando de evidencia local.
#   staged             Escanea el contenido staged. Lo usa el hook de pre-commit.
#   range BASE HEAD    Escanea los archivos que cambian en BASE..HEAD, tomando su
#                      contenido en HEAD. Es el gate de CI: solo hallazgos nuevos.
#   history            Escanea toda la historia. Informativo: nunca falla.
#
# Ejemplos:
#   tools/security/scan-secrets.sh
#   tools/security/scan-secrets.sh range origin/main HEAD

set -euo pipefail

GITLEAKS_IMAGE="${GITLEAKS_IMAGE:-ghcr.io/gitleaks/gitleaks:v8.30.1}"
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

MODE="${1:-worktree}"

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: se requiere Docker en ejecucion (Python y tooling solo via Docker)." >&2
  exit 2
fi

STAGE=""
# Debe devolver 0 siempre: un trap EXIT que falla altera el codigo de salida real
# del script y haria pasar por error un modo que no monto directorio temporal.
cleanup() {
  [ -n "$STAGE" ] && rm -rf "$STAGE"
  return 0
}
trap cleanup EXIT

# Copia a $STAGE, conservando rutas relativas, la lista de archivos NUL-separada
# que llega por stdin. $1: "worktree" (archivo en disco), "index" (contenido
# staged) o un revision-ish (contenido en ese commit).
materialize() {
  local src="$1" path dest
  while IFS= read -r -d '' path; do
    dest="$STAGE/$path"
    mkdir -p "$(dirname "$dest")"
    case "$src" in
      worktree)
        # Un archivo listado pero ausente en disco es un borrado sin stage.
        [ -f "$path" ] || continue
        cp "$path" "$dest"
        ;;
      index)
        if ! git show ":$path" >"$dest"; then
          echo "ERROR: no se pudo leer el contenido staged de $path" >&2
          return 1
        fi
        ;;
      *)
        if ! git show "$src:$path" >"$dest"; then
          echo "ERROR: no se pudo leer $path en $src" >&2
          return 1
        fi
        ;;
    esac
  done
}

# gitleaks sobre un directorio, con rutas relativas para que las allowlist de
# .gitleaks.toml (que usan rutas del repo) apliquen igual que en un checkout.
scan_dir() {
  local target="$1" exit_code="${2:-1}"
  if [ -z "$(find "$target" -type f -print -quit)" ]; then
    echo "Sin archivos que escanear."
    return 0
  fi
  docker run --rm \
    -v "$target:/scan:ro" \
    -v "$REPO_ROOT/.gitleaks.toml:/config/.gitleaks.toml:ro" \
    -w /scan \
    "$GITLEAKS_IMAGE" dir . \
      --config /config/.gitleaks.toml \
      --redact \
      --no-banner \
      --exit-code "$exit_code"
}

case "$MODE" in
  worktree)
    "$REPO_ROOT/tools/security/check-tracked-secrets.sh"
    STAGE="$(mktemp -d)"
    git ls-files -c -o --exclude-standard -z | materialize worktree
    echo "Escaneando working tree commiteable (tracked + untracked no ignorados)..."
    scan_dir "$STAGE" 1
    ;;

  staged)
    "$REPO_ROOT/tools/security/check-tracked-secrets.sh"
    STAGE="$(mktemp -d)"
    git diff --cached --name-only --diff-filter=ACMR -z | materialize index
    echo "Escaneando contenido staged..."
    scan_dir "$STAGE" 1
    ;;

  range)
    base="${2:?uso: scan-secrets.sh range BASE HEAD}"
    head="${3:?uso: scan-secrets.sh range BASE HEAD}"
    "$REPO_ROOT/tools/security/check-tracked-secrets.sh"
    STAGE="$(mktemp -d)"
    git diff --name-only --diff-filter=ACMR -z "$base" "$head" | materialize "$head"
    echo "Escaneando archivos nuevos/modificados en $base..$head (contenido en $head)..."
    scan_dir "$STAGE" 1
    ;;

  history)
    # Solo informativo. El hallazgo de SEC-101 esta allowlisteado por commit y el
    # resto de la historia se reporta sin bloquear.
    if [ ! -d "$REPO_ROOT/.git" ]; then
      echo "AVISO: worktree enlazado (.git es un archivo); el escaneo de historia" \
           "corre en CI, donde el checkout tiene un .git real. Omitido."
      exit 0
    fi
    report="${GITLEAKS_REPORT:-}"
    args=(git . --config /config/.gitleaks.toml --redact --no-banner --exit-code 0)
    mounts=(-v "$REPO_ROOT:/scan:ro" -v "$REPO_ROOT/.gitleaks.toml:/config/.gitleaks.toml:ro")
    if [ -n "$report" ]; then
      mkdir -p "$(dirname "$report")"
      mounts+=(-v "$(cd "$(dirname "$report")" && pwd):/out")
      args+=(--report-format json --report-path "/out/$(basename "$report")")
    fi
    echo "Escaneando historia completa (informativo, no bloquea)..."
    docker run --rm "${mounts[@]}" -w /scan \
      -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0=/scan \
      "$GITLEAKS_IMAGE" "${args[@]}"
    ;;

  *)
    echo "Modo desconocido: $MODE (worktree | staged | range BASE HEAD | history)" >&2
    exit 2
    ;;
esac
