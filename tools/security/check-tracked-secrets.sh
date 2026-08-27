#!/usr/bin/env bash
# SEC-102 — Guardia de archivos de credenciales.
#
# gitleaks solo ve contenido; este control ve *nombres*. Falla si un archivo que
# por politica debe permanecer fuera de Git aparece tracked o en el index.
# Nunca imprime contenido: solo rutas.
#
# Uso: tools/security/check-tracked-secrets.sh

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Rutas que jamas deben entrar a Git. .env.example es la unica plantilla permitida.
FORBIDDEN_REGEX='(^|/)(\.env(\..*)?|.*\.(pem|key|p12|pfx|keystore|jks)|id_rsa|id_ed25519|secrets\.json|credentials\.json|service-account.*\.json)$'
ALLOWED_REGEX='(^|/)\.env\.example$'

collect() {
  # $1: "tracked" | "staged"
  case "$1" in
    tracked) git ls-files ;;
    staged) git diff --cached --name-only --diff-filter=ACMR ;;
  esac
}

status=0
for scope in tracked staged; do
  offenders="$(collect "$scope" | grep -E "$FORBIDDEN_REGEX" | grep -Ev "$ALLOWED_REGEX" || true)"
  if [ -n "$offenders" ]; then
    echo "ERROR: archivos de credenciales en Git ($scope):" >&2
    printf '  - %s\n' $offenders >&2
    status=1
  fi
done

if [ "$status" -ne 0 ]; then
  echo "Remuevelos del index (git rm --cached <ruta>) y confirma que .gitignore los cubra." >&2
  echo "No borres ni reescribas historia sin autorizacion; escala como incidente." >&2
  exit 1
fi

echo "OK: ningun archivo de credenciales esta tracked ni en el index."
