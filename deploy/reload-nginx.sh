#!/bin/bash
# Sync nginx config to VPS and reload (no Docker rebuild).
set -euo pipefail

HOST="${DEPLOY_HOST:-root@109.69.17.233}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

rsync -az "$ROOT/deploy/nginx/" "$HOST:/opt/qrstars/deploy/nginx/"

ssh "$HOST" bash -s <<'REMOTE'
set -euo pipefail
CONF_SRC="/opt/qrstars/deploy/nginx/app.qrstars.ru.conf"
CONF_DST="/etc/nginx/sites-available/app.qrstars.ru.conf"
UPSTREAM_SRC="/opt/qrstars/deploy/nginx/qrstars-upstream.conf"

install -m 644 "$CONF_SRC" "$CONF_DST"
install -m 644 "$UPSTREAM_SRC" /etc/nginx/conf.d/qrstars-upstream.conf
ln -sf "$CONF_DST" /etc/nginx/sites-enabled/app.qrstars.ru.conf
nginx -t
systemctl reload nginx
echo "Nginx reloaded."
REMOTE

echo "Nginx config updated on $HOST"
