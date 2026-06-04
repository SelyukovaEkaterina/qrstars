#!/bin/bash
# Redeploy from your machine: ./deploy/deploy.sh
set -euo pipefail

HOST="${DEPLOY_HOST:-root@109.69.17.233}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# .env не rsync'ится — на VPS используется /opt/qrstars/.env

rsync -az --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude .env \
  --exclude e2e/__pycache__ \
  "$ROOT/" "$HOST:/opt/qrstars/"

ssh "$HOST" "cd /opt/qrstars/deploy && ln -sf ../.env .env && set -a && . ../.env && set +a && docker compose -f docker-compose.prod.yml build && docker compose -f docker-compose.prod.yml up -d"

echo "Deploy complete."
