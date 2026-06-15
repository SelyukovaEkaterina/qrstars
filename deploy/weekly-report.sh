#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] .env not found at $ENV_FILE" >&2
  exit 1
fi

CRON_SECRET=""
BASE_URL="https://app.qrstars.ru"

while IFS='=' read -r key val; do
  key="$(echo "$key" | xargs)"
  val="$(echo "$val" | xargs)"
  case "$key" in
    CRON_SECRET) CRON_SECRET="$val" ;;
    NEXT_PUBLIC_BASE_URL) BASE_URL="$val" ;;
  esac
done < "$ENV_FILE"

if [[ -z "$CRON_SECRET" ]]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] CRON_SECRET not set in $ENV_FILE" >&2
  exit 1
fi

URL="${BASE_URL}/api/cron/weekly-report"
TIMEOUT=120

http_code="$(curl -sf -o /tmp/qrstars_weekly_report.json -w '%{http_code}' \
  --max-time "$TIMEOUT" \
  -X POST "$URL" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  2>/dev/null || echo "000")"

if [[ "$http_code" == "200" ]]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Weekly report sent — $(cat /tmp/qrstars_weekly_report.json 2>/dev/null || echo ok)"
  exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Weekly report FAILED — HTTP $http_code" >&2
cat /tmp/qrstars_weekly_report.json 2>/dev/null || true
exit 1
