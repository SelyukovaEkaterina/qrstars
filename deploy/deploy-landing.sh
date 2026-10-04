#!/bin/bash
# Build landing (Astro, landing/) and publish static files to the VPS (served by nginx from /var/www/qrstars).
set -euo pipefail

HOST="${DEPLOY_HOST:-root@109.69.17.233}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT/landing"
npm ci
npm run build

ssh "$HOST" "mkdir -p /var/www/qrstars"
rsync -az --delete dist/ "$HOST:/var/www/qrstars/"

echo "Landing published to $HOST:/var/www/qrstars"
