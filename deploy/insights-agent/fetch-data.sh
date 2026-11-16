#!/usr/bin/env bash
# Готовит всё для недельного ИИ-отчёта: обновляет клон репозитория и скачивает
# пакет метрик за прошлую неделю. Запускается агентом Hermes из скилла
# qrstars-weekly-insights. Печатает путь к JSON последней строкой.
set -euo pipefail

ENV_FILE="${INSIGHTS_ENV_FILE:-$HOME/.qrstars-insights.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "env not found: $ENV_FILE" >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

: "${INSIGHTS_DATA_SECRET:?INSIGHTS_DATA_SECRET is not set}"
DATA_URL="${INSIGHTS_DATA_URL:-https://app.qrstars.ru/api/cron/insights-data}"
REPO_DIR="${QRSTARS_REPO_DIR:-$HOME/qrstars}"
WORK_DIR="${INSIGHTS_WORK_DIR:-$HOME/insights}"

mkdir -p "$WORK_DIR/data" "$WORK_DIR/reports"

# Клон только для чтения: локальные правки агента затираются.
if [[ -d "$REPO_DIR/.git" ]]; then
  git -C "$REPO_DIR" fetch --quiet origin main
  git -C "$REPO_DIR" reset --quiet --hard origin/main
  git -C "$REPO_DIR" clean --quiet -fd
else
  echo "repo not found: $REPO_DIR" >&2
  exit 1
fi

OUT="$WORK_DIR/data/$(TZ=Europe/Moscow date +%F).json"
http_code="$(curl -sS -o "$OUT.tmp" -w '%{http_code}' --max-time 180 \
  -H "Authorization: Bearer ${INSIGHTS_DATA_SECRET}" "$DATA_URL" || echo 000)"

if [[ "$http_code" != "200" ]]; then
  echo "insights-data HTTP $http_code" >&2
  head -c 500 "$OUT.tmp" >&2 || true
  rm -f "$OUT.tmp"
  exit 1
fi
mv "$OUT.tmp" "$OUT"

# Старые пакеты не копим дольше полугода.
find "$WORK_DIR/data" -name '*.json' -mtime +180 -delete 2>/dev/null || true

echo "$OUT"
