#!/usr/bin/env bash
# certbot --manual-auth-hook для *.qrstars.ru (DNS-01, DNS на Beget без API).
# Пишет значение TXT в /root/acme-challenge.txt и ждёт, пока запись
# _acme-challenge.qrstars.ru появится на NS Beget (до ACME_WAIT_SEC, default 1800).
# TXT добавляется вручную: панель Beget → DNS → qrstars.ru → TXT _acme-challenge.
set -euo pipefail

NAME="_acme-challenge.${CERTBOT_DOMAIN}"
VALUE="${CERTBOT_VALIDATION}"
WAIT_SEC="${ACME_WAIT_SEC:-1800}"

echo "${NAME} TXT ${VALUE}" >> /root/acme-challenge.txt
echo "Add DNS record: ${NAME} TXT \"${VALUE}\""

deadline=$(( $(date +%s) + WAIT_SEC ))
while (( $(date +%s) < deadline )); do
  if dig +short TXT "$NAME" @ns1.beget.com | tr -d '"' | grep -qxF "$VALUE"; then
    # Даём остальным NS Beget подтянуть запись
    sleep 60
    exit 0
  fi
  sleep 15
done

echo "TXT ${NAME} not found within ${WAIT_SEC}s" >&2
exit 1
