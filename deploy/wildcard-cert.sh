#!/bin/bash
# Сертификат *.qrstars.ru для коротких адресов микросайтов ({slug}.qrstars.ru).
# DNS-01 не требует, чтобы A-запись уже смотрела на сервер, — можно выпустить заранее.
# Запуск на VPS:
#   bash /opt/qrstars/deploy/wildcard-cert.sh
# Два сертификата (ECDSA + RSA для старых клиентов) — значит, certbot дважды
# попросит TXT _acme-challenge.qrstars.ru: значение печатается в консоль и в
# /root/acme-challenge.txt, его нужно вручную добавить в DNS (старую TXT-запись
# можно заменить). Хук сам дождётся появления записи.
# Продление тоже ручное (DNS без API): повторить скрипт за пару недель до конца срока.
set -euo pipefail

HOOK=/opt/qrstars/deploy/acme-dns-wait.sh
chmod +x "$HOOK"

certbot certonly --manual --preferred-challenges dns \
  --manual-auth-hook "$HOOK" \
  --cert-name qrstars.ru-wildcard --key-type ecdsa \
  -d '*.qrstars.ru' \
  --non-interactive --agree-tos --register-unsafely-without-email

certbot certonly --manual --preferred-challenges dns \
  --manual-auth-hook "$HOOK" \
  --cert-name qrstars.ru-wildcard-rsa --key-type rsa \
  -d '*.qrstars.ru' \
  --non-interactive --agree-tos --register-unsafely-without-email

# То же, что делают deploy.sh / reload-nginx.sh, когда сертификат уже есть.
install -m 644 /opt/qrstars/deploy/nginx/wildcard.qrstars.ru.conf /etc/nginx/sites-available/wildcard.qrstars.ru.conf
ln -sf /etc/nginx/sites-available/wildcard.qrstars.ru.conf /etc/nginx/sites-enabled/wildcard.qrstars.ru.conf
nginx -t
systemctl reload nginx
echo "Wildcard *.qrstars.ru enabled."
