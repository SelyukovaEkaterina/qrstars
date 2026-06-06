#!/bin/bash
# Zero-downtime deploy: blue-green app swap (nginx keeps serving old slot until new is healthy).
set -euo pipefail

HOST="${DEPLOY_HOST:-root@109.69.17.233}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

rsync -az --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude .env \
  --exclude e2e/__pycache__ \
  "$ROOT/" "$HOST:/opt/qrstars/"

ssh "$HOST" bash -s <<'REMOTE'
set -euo pipefail
cd /opt/qrstars/deploy
ln -sf ../.env .env
set -a && . ../.env && set +a

ACTIVE_FILE=".active_app"
ACTIVE="$(cat "$ACTIVE_FILE" 2>/dev/null || echo blue)"
if [[ "$ACTIVE" == "blue" ]]; then
  TARGET=green
  TARGET_PORT=3001
  OLD=blue
else
  TARGET=blue
  TARGET_PORT=3000
  OLD=green
fi

echo "==> Active: $ACTIVE → deploying $TARGET (port $TARGET_PORT)"

docker compose -f docker-compose.prod.yml build "app_${TARGET}"

echo "==> Starting app_${TARGET} (old app_${OLD} still serving traffic)..."
docker compose -f docker-compose.prod.yml up -d db valkey pgbouncer
docker compose -f docker-compose.prod.yml up -d --no-deps "app_${TARGET}"

echo "==> Waiting for health on 127.0.0.1:${TARGET_PORT}..."
ready=0
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${TARGET_PORT}/api/auth/csrf" >/dev/null 2>&1; then
    ready=1
    echo "    healthy after ${i} attempt(s)"
    break
  fi
  sleep 2
done

if [[ "$ready" -ne 1 ]]; then
  echo "ERROR: app_${TARGET} did not become healthy — rolling back (nginx unchanged)" >&2
  docker compose -f docker-compose.prod.yml stop "app_${TARGET}" || true
  exit 1
fi

UPSTREAM="/opt/qrstars/deploy/nginx/qrstars-upstream.conf"
cat > "$UPSTREAM" <<EOF
upstream qrstars_app {
    server 127.0.0.1:${TARGET_PORT};
    keepalive 32;
}
EOF

install -m 644 "$UPSTREAM" /etc/nginx/conf.d/qrstars-upstream.conf
CONF_SRC="/opt/qrstars/deploy/nginx/app.qrstars.ru.conf"
CONF_DST="/etc/nginx/sites-available/app.qrstars.ru.conf"
install -m 644 "$CONF_SRC" "$CONF_DST"
ln -sf "$CONF_DST" /etc/nginx/sites-enabled/app.qrstars.ru.conf
nginx -t
systemctl reload nginx

echo "==> Traffic switched to port ${TARGET_PORT}, stopping app_${OLD}..."
docker compose -f docker-compose.prod.yml stop "app_${OLD}" 2>/dev/null || true

echo "$TARGET" > "$ACTIVE_FILE"
docker rm -f deploy-app-1 2>/dev/null || true

echo "Deploy complete. Active slot: $TARGET (port $TARGET_PORT)"
REMOTE

echo "Deploy complete."
