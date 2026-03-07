#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-../docker-compose.prod.yml}"
APP_SERVICE="${APP_SERVICE:-app}"
APP_CONTAINER="${APP_CONTAINER:-tynys-app}"
SIGNIN_URL="${SIGNIN_URL:-http://89.218.178.215:3010/en/sign-in}"
NO_CACHE="${NO_CACHE:-true}"

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "Neither 'docker compose' nor 'docker-compose' is available."
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Compose file not found: $COMPOSE_FILE"
  exit 1
fi

if [ -z "${POSTGRES_PASSWORD:-}" ]; then
  echo "POSTGRES_PASSWORD is required. Export it before running this script."
  exit 1
fi

if [ -z "${NEXTAUTH_SECRET:-}" ]; then
  echo "NEXTAUTH_SECRET is required. Export it before running this script."
  exit 1
fi

if [ -z "${IOT_DEVICE_SECRET:-}" ]; then
  echo "IOT_DEVICE_SECRET is required. Export it before running this script."
  exit 1
fi

echo "Current commit: $(git rev-parse HEAD)"

if [ -f ../.next/BUILD_ID ]; then
  echo "Local Next.js BUILD_ID: $(cat ../.next/BUILD_ID)"
else
  echo "Local Next.js BUILD_ID: missing"
fi

BUILD_ARGS=()
if [ "$NO_CACHE" = "true" ]; then
  BUILD_ARGS+=(--no-cache)
fi

echo "Building Docker image..."
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" build "${BUILD_ARGS[@]}" "$APP_SERVICE"

echo "Restarting app service..."
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" up -d --force-recreate "$APP_SERVICE"

echo "Recent app logs:"
"${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" logs --tail=40 "$APP_SERVICE"

echo "Running containers:"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'

echo "Container BUILD_ID:"
docker exec "$APP_CONTAINER" sh -lc "cat .next/BUILD_ID || echo missing"

echo "Container runtime:"
docker exec "$APP_CONTAINER" sh -lc "node -e \"console.log(process.version, process.env.NODE_ENV, process.env.RELEASE_TAG || 'no-release-tag')\""

echo "Sign-in page buildId:"
curl -s "$SIGNIN_URL" | grep -o '"buildId":"[^\"]*"' || echo 'buildId not found'

echo "Redeploy script completed successfully."
