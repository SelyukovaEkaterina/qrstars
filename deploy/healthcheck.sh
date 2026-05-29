#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] .env not found at $ENV_FILE" >&2
  exit 1
fi

BOT_TOKEN=""
SUPPORT_GROUP_ID=""

while IFS='=' read -r key val; do
  key="$(echo "$key" | xargs)"
  val="$(echo "$val" | xargs)"
  case "$key" in
    TELEGRAM_SUPPORT_BOT_TOKEN) BOT_TOKEN="$val" ;;
    TELEGRAM_SUPPORT_GROUP_ID)  SUPPORT_GROUP_ID="$val" ;;
  esac
done < "$ENV_FILE"

if [[ -z "$BOT_TOKEN" || -z "$SUPPORT_GROUP_ID" ]]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] TELEGRAM_SUPPORT_BOT_TOKEN or TELEGRAM_SUPPORT_GROUP_ID not set" >&2
  exit 1
fi

HEALTH_URL="https://app.qrstars.ru/scan/demo-landing"
DEMO_URL="https://qrstars.ru"
TIMEOUT=15

send_alert() {
  local msg="$1"
  curl -sf -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -d chat_id="$SUPPORT_GROUP_ID" \
    -d parse_mode=HTML \
    -d text="$msg" \
    -d disable_web_page_preview=true \
    > /dev/null 2>&1 || true
}

STATUS_FILE="/tmp/qrstars_health_last_fail"
ALERT_COOLDOWN=1800

now_epoch() { date +%s; }

should_alert() {
  if [[ -f "$STATUS_FILE" ]]; then
    local last
    last="$(cat "$STATUS_FILE")"
    local now
    now="$(now_epoch)"
    if (( now - last < ALERT_COOLDOWN )); then
      return 1
    fi
  fi
  return 0
}

app_code=0
site_code=0

app_code="$(curl -sf -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$HEALTH_URL" 2>/dev/null || echo "000")"
site_code="$(curl -sf -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$DEMO_URL" 2>/dev/null || echo "000")"

if [[ "$app_code" == "200" && "$site_code" == "200" ]]; then
  if [[ -f "$STATUS_FILE" ]]; then
    rm -f "$STATUS_FILE"
    send_alert "✅ <b>QrStars мониторинг восстановлен</b>

app.qrstars.ru — $app_code
qrstars.ru — $site_code

Все сервисы снова работают."
  fi
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK — app=$app_code site=$site_code"
  exit 0
fi

now_epoch > "$STATUS_FILE"

if should_alert; then
  now_epoch > "$STATUS_FILE"

  msg="🚨 <b>QrStars мониторинг — сбой!</b>

"
  if [[ "$app_code" != "200" ]]; then
    msg+="❌ <b>app.qrstars.ru</b> — HTTP $app_code
URL: $HEALTH_URL

"
  fi
  if [[ "$site_code" != "200" ]]; then
    msg+="❌ <b>qrstars.ru</b> (лендинг) — HTTP $site_code
URL: $DEMO_URL

"
  fi
  msg+="⏰ $(date '+%d.%m.%Y %H:%M:%S MSK')"

  send_alert "$msg"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] FAIL — app=$app_code site=$site_code"
exit 1
