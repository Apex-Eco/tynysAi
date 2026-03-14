#!/usr/bin/env bash
set -euo pipefail

# Fresh production rebuild/restart helper for docker-compose.prod.yml
# Default behavior keeps database volumes. Pass --drop-volumes for full reset.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/docker-compose.prod.yml}"
APP_SERVICE="${APP_SERVICE:-app}"
DB_SERVICE="${DB_SERVICE:-postgres}"
APP_PORT="${APP_PORT:-3010}"
APP_HEALTH_URL="${APP_HEALTH_URL:-http://127.0.0.1:${APP_PORT}/en/sign-in}"
DROP_VOLUMES="false"

if [[ "${1:-}" == "--drop-volumes" ]]; then
  DROP_VOLUMES="true"
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "Error: neither 'docker compose' nor 'docker-compose' is available."
  exit 1
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Error: compose file not found: ${COMPOSE_FILE}"
  exit 1
fi

cd "${ROOT_DIR}"

echo "==> Using compose file: ${COMPOSE_FILE}"
echo "==> Project root: ${ROOT_DIR}"

if [[ "${DROP_VOLUMES}" == "true" ]]; then
  echo "==> Stopping stack and dropping volumes (DESTRUCTIVE FOR DB DATA)"
  "${COMPOSE_CMD[@]}" -f "${COMPOSE_FILE}" down --remove-orphans --volumes
else
  echo "==> Stopping stack (keeping volumes)"
  "${COMPOSE_CMD[@]}" -f "${COMPOSE_FILE}" down --remove-orphans
fi

echo "==> Rebuilding ${APP_SERVICE} image with no cache"
"${COMPOSE_CMD[@]}" -f "${COMPOSE_FILE}" build --no-cache --pull "${APP_SERVICE}"

echo "==> Starting ${DB_SERVICE} + ${APP_SERVICE} with force recreate"
"${COMPOSE_CMD[@]}" -f "${COMPOSE_FILE}" up -d --force-recreate --remove-orphans "${DB_SERVICE}" "${APP_SERVICE}"

echo "==> Running containers"
"${COMPOSE_CMD[@]}" -f "${COMPOSE_FILE}" ps

echo "==> Recent app logs"
"${COMPOSE_CMD[@]}" -f "${COMPOSE_FILE}" logs --tail=80 "${APP_SERVICE}"

echo "==> Checking app availability: ${APP_HEALTH_URL}"
for i in {1..20}; do
  if curl -fsS "${APP_HEALTH_URL}" >/dev/null 2>&1; then
    echo "App is reachable."
    exit 0
  fi
  sleep 2
done

echo "Warning: app health check did not pass yet. Check logs above."
exit 1
