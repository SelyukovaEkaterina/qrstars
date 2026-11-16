# Недельный ИИ-аналитик (Hermes + DeepSeek)

Раз в неделю (понедельник 11:00 МСК) агент [Hermes](https://github.com/NousResearch/hermes-agent) на VPS:

1. `fetch-data.sh` — обновляет клон репозитория и скачивает пакет метрик за прошлую неделю с `GET https://app.qrstars.ru/api/cron/insights-data` (база + Яндекс Метрика, без персональных данных);
2. скилл `qrstars-weekly-insights` — читает пакет, базу гипотез `knowledge/` и прошлые отчёты, пишет инсайты (продукт / трафик / идеи / гипотезы) на DeepSeek;
3. отправляет сообщение владельцу в Telegram и сохраняет отчёт в `~/insights/reports/`.

В тот же Telegram-бот можно писать вопросы — агент ответит, видя репозиторий и прошлые отчёты.

## Что где

| Что | Где |
|---|---|
| Пакет данных (код) | `src/lib/insights/weekly-insights-data.ts`, `metrika-report.ts`, роут `src/app/api/cron/insights-data` |
| Секрет пакета | `INSIGHTS_DATA_SECRET` в `/opt/qrstars/.env` и `~hermes/.qrstars-insights.env` |
| Клон репо (read-only, deploy key) | `/home/hermes/qrstars` |
| Пакеты и отчёты | `/home/hermes/insights/{data,reports}` |
| Hermes: ключи, конфиг, cron | `/home/hermes/.hermes/{.env,config.yaml,cron/}` |

Агент работает от пользователя `hermes` без sudo и без группы `docker`; `/opt/qrstars/.env` закрыт (`600 root`).

## Установка

Нужны: API-ключ DeepSeek, новый бот от @BotFather (не `@QrStarsBot` и не support-бот: гейтвей Hermes забирает апдейты сам и сломает их вебхуки), свой Telegram user id (@userinfobot).

```bash
# с локальной машины: выкатить приложение с ручкой insights-data
./deploy/deploy.sh

# на сервере от root
ssh root@138.16.170.220
bash /opt/qrstars/deploy/insights-agent/setup.sh
# если скрипт напечатал ключ — добавить его в GitHub → repo → Settings → Deploy keys (без write), запустить ещё раз
# если добавил INSIGHTS_DATA_SECRET — ещё раз ./deploy/deploy.sh с локальной машины
```

### Hermes

```bash
su - hermes
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
source ~/.bashrc

# ключи
cat >> ~/.hermes/.env <<'EOF'
DEEPSEEK_API_KEY=sk-...
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_ALLOWED_USERS=<ваш telegram id>
EOF
chmod 600 ~/.hermes/.env
```

`~/.hermes/config.yaml` — добавить/поправить:

```yaml
model:
  provider: deepseek
  default: deepseek-chat
skills:
  external_dirs:
    - /home/hermes/qrstars/deploy/insights-agent/skills
```

Если `provider: deepseek` в вашей версии нет — через `hermes model` → «Custom endpoint», `https://api.deepseek.com/v1`.

```bash
hermes gateway install          # user-сервис systemd, cron крутится в гейтвее
hermes gateway start
# написать боту в Telegram /sethome — личка станет каналом доставки

# проверка вручную
bash ~/qrstars/deploy/insights-agent/fetch-data.sh
hermes cron create "0 11 * * 1" "Подготовь недельный отчёт QrStars по скиллу qrstars-weekly-insights" \
  --skill qrstars-weekly-insights --deliver telegram --timezone Europe/Moscow --name "qrstars-weekly-insights"
hermes cron list
hermes cron run <job_id>        # прогнать сразу (если команды нет — `/cron` в чате с ботом)
```

Логи: `journalctl --user -u hermes-gateway -f`, вывод прогонов — `~/.hermes/cron/output/`.

## Данные и ПД

Пакет уходит во внешнюю LLM (DeepSeek, серверы вне РФ), поэтому в нём только агрегаты: без email, имён, телефонов, названий проектов и id пользователей. Комментарии из опросов проходят `scrubPii`. Новые поля в пакет — только агрегаты; e2e `e2e/test_insights_data.py` проверяет, что email не утекает.
