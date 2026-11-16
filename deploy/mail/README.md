# Входящая почта: ответы на письма → чат поддержки

Postfix на VPS принимает письма на любой адрес `@qrstars.ru` (catch-all → `support`)
и через pipe отдаёт их скрипту `inbound-to-app.py`. Скрипт разбирает письмо и шлёт
JSON в `POST https://app.qrstars.ru/api/inbound-email` (Bearer `INBOUND_EMAIL_SECRET`).
Письмо от email пользователя становится сообщением в его чате поддержки
(кабинет и тема в Telegram-форуме), ответ оператора уходит обратно письмом.
Письма с незнакомых адресов попадают в тему «📬 Почта» support-форума;
реплай на такое письмо в Telegram уходит отправителю письмом.
Автоответы и отчёты о недоставке отбрасываются.

Письма уходят с `Reply-To: support@qrstars.ru` (`SMTP_REPLY_TO` в `/opt/qrstars/.env`).
Адрес `noreply@` тоже принимается: на него отвечают на старые письма.

## Установка (один раз)

```bash
# 1. Секрет: один и тот же в файле (читает скрипт от nobody) и в .env приложения
S=$(openssl rand -hex 32)
mkdir -p /etc/qrstars && chmod 0751 /etc/qrstars
printf '%s\n' "$S" > /etc/qrstars/inbound-email.secret
chown root:nogroup /etc/qrstars/inbound-email.secret && chmod 0640 /etc/qrstars/inbound-email.secret
# в /opt/qrstars/.env (дописывать, не sed -i — там симлинк):
#   INBOUND_EMAIL_SECRET='…'
#   SMTP_REPLY_TO='QrStars <support@qrstars.ru>'
# затем ./deploy/deploy.sh

# 2. Postfix
# qrstars.ru — виртуальный домен (catch-all), mail.qrstars.ru/localhost — локальная почта сервера (cron → root)
postconf -e 'mydestination = localhost, mail.qrstars.ru'
postconf -e 'virtual_alias_domains = qrstars.ru'
postconf -e 'virtual_alias_maps = hash:/etc/postfix/virtual'
printf '@qrstars.ru support@localhost\n' > /etc/postfix/virtual && postmap /etc/postfix/virtual
postconf -e 'local_recipient_maps = $alias_maps'
postconf -e 'smtpd_helo_required = yes'
postconf -e 'smtpd_sender_restrictions = reject_non_fqdn_sender, reject_unknown_sender_domain'
postconf -e 'smtpd_recipient_restrictions = permit_mynetworks, reject_unauth_destination'
postconf -e 'smtpd_tls_cert_file = /etc/letsencrypt/live/qrstars.ru-wildcard/fullchain.pem'
postconf -e 'smtpd_tls_key_file = /etc/letsencrypt/live/qrstars.ru-wildcard/privkey.pem'
postconf -e 'smtpd_tls_security_level = may'
cat >> /etc/aliases <<'EOF'
support: "|/usr/bin/python3 -I /opt/qrstars/deploy/mail/inbound-to-app.py"
EOF
newaliases && systemctl reload postfix

# 3. Перечитывать сертификат после продления
printf '#!/bin/sh\nsystemctl reload postfix\n' > /etc/letsencrypt/renewal-hooks/deploy/reload-postfix.sh
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-postfix.sh
```

DNS (webnames): `qrstars.ru MX 10 mail.qrstars.ru` (A `mail` уже есть).
Без MX отправители берут A-запись `qrstars.ru` — тот же VPS, но MX надёжнее.

## Проверка и логи

- `grep inbound-to-app /var/log/mail.log` — ответ приложения на каждое письмо (`200 {"delivered":"support_ticket"}`).
- Приложение недоступно (деплой) → скрипт возвращает 75, Postfix повторит позже (`mailq`).
- Защита: на один адрес — не больше 10 писем в час, от незнакомых всего — 30 в час.
  SPF/DKIM входящих не проверяются: From можно подделать, письмо попадёт в чат того пользователя
  (только как сообщение от него, доступа к аккаунту это не даёт).
