#!/bin/bash
# Выпуск Let's Encrypt на новом VPS вместо временных самоподписанных сертификатов
# (`.placeholder` в /etc/letsencrypt/live/*). Запускать на VPS, когда A-записи
# app.qrstars.ru, qrstars.ru, www.qrstars.ru уже смотрят на этот сервер.
#
# standalone: nginx на ~10 секунд останавливается. Так проще, чем webroot —
# в конфигах :80 стоит безусловный return 301. Те же pre/post-хуки certbot
# сохраняет в renewal-конфиг, автопродление работает так же.
set -euo pipefail

EMAIL_ARGS=(--register-unsafely-without-email)
HOOKS=(--pre-hook "systemctl stop nginx" --post-hook "systemctl start nginx")

issue() {
  local name="$1" key="$2"; shift 2
  local live="/etc/letsencrypt/live/$name"
  local backup="/root/placeholder-certs/$name"
  if [[ -d "$live" && -f "$live/.placeholder" ]]; then
    mkdir -p /root/placeholder-certs && rm -rf "$backup" && mv "$live" "$backup"
  elif [[ -d "$live" ]]; then
    echo "==> $name уже выпущен, пропускаю"
    return
  fi
  if ! certbot certonly --standalone --non-interactive --agree-tos "${EMAIL_ARGS[@]}" \
    "${HOOKS[@]}" --cert-name "$name" --key-type "$key" "$@"; then
    # Без файла сертификата nginx не стартует — возвращаем временный.
    [[ -d "$backup" ]] && mv "$backup" "$live"
    systemctl start nginx || true
    echo "ERROR: не удалось выпустить $name — проверьте A-записи" >&2
    exit 1
  fi
}

issue app.qrstars.ru ecdsa -d app.qrstars.ru
issue app.qrstars.ru-rsa rsa -d app.qrstars.ru
issue qrstars.ru ecdsa -d qrstars.ru -d www.qrstars.ru
issue qrstars.ru-rsa rsa -d qrstars.ru -d www.qrstars.ru

install -m 755 /opt/qrstars/deploy/certbot-deploy-hook.sh /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
systemctl enable --now certbot.timer
nginx -t && systemctl reload nginx
echo "Certificates issued."
