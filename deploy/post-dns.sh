#!/bin/bash
# Run on VPS after A-records point to this server (109.69.17.233):
#   app.qrstars.ru, qrstars.ru, www.qrstars.ru
set -euo pipefail

certbot --nginx \
  -d app.qrstars.ru \
  -d qrstars.ru \
  -d www.qrstars.ru \
  --non-interactive \
  --agree-tos \
  --redirect \
  --register-unsafely-without-email

env_get() { grep -m1 "^$1=" /opt/qrstars/deploy/.env | cut -d= -f2- | tr -d '"'; }

TELEGRAM_BOT_TOKEN=$(env_get TELEGRAM_BOT_TOKEN)
TELEGRAM_SUPPORT_BOT_TOKEN=$(env_get TELEGRAM_SUPPORT_BOT_TOKEN)
MAX_BOT_ACCESS_TOKEN=$(env_get MAX_BOT_ACCESS_TOKEN)
MAX_WEBHOOK_SECRET=$(env_get MAX_WEBHOOK_SECRET)

curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://app.qrstars.ru/api/telegram/webhook"

if [ -n "${TELEGRAM_SUPPORT_BOT_TOKEN}" ]; then
  curl -fsS "https://api.telegram.org/bot${TELEGRAM_SUPPORT_BOT_TOKEN}/setWebhook" \
    -d "url=https://app.qrstars.ru/api/telegram/support-webhook"
fi

curl -fsS -X POST "https://platform-api.max.ru/subscriptions" \
  -H "Authorization: ${MAX_BOT_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://app.qrstars.ru/api/max/webhook\",\"update_types\":[\"bot_started\",\"message_created\"],\"secret\":\"${MAX_WEBHOOK_SECRET}\"}"

install -m 755 /opt/qrstars/deploy/certbot-deploy-hook.sh /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
systemctl enable certbot.timer
systemctl start certbot.timer

echo "SSL and bot webhooks configured."
