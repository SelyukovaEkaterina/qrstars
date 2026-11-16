#!/usr/bin/env bash
# Подготовка VPS под ИИ-аналитика (Hermes Agent). Запускать от root на сервере:
#   bash /opt/qrstars/deploy/insights-agent/setup.sh
# Идемпотентен. Сам Hermes и токены ставятся по шагам из README.md рядом.
set -euo pipefail

AGENT_USER="${AGENT_USER:-hermes}"
REPO_SSH="${REPO_SSH:-git@github.com:SelyukovaEkaterina/qrstars.git}"
HOME_DIR="/home/$AGENT_USER"

# 1. Отдельный пользователь без sudo и без группы docker: у агента есть терминал,
#    ему нельзя видеть /opt/qrstars/.env и управлять контейнерами.
if ! id "$AGENT_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$AGENT_USER"
  echo "user $AGENT_USER created"
fi
if id -nG "$AGENT_USER" | grep -qw docker; then
  echo "WARNING: $AGENT_USER в группе docker — уберите: gpasswd -d $AGENT_USER docker" >&2
fi

# Прод-секреты должны быть закрыты от агента.
for f in /opt/qrstars/.env /opt/qrstars/deploy/.env; do
  if [[ -e "$f" ]]; then
    real="$(readlink -f "$f")"
    chown root:root "$real"
    chmod 600 "$real"
  fi
done

# 2. Deploy key (read-only) для клона репозитория.
sudo -u "$AGENT_USER" mkdir -p "$HOME_DIR/.ssh" "$HOME_DIR/insights/data" "$HOME_DIR/insights/reports"
chmod 700 "$HOME_DIR/.ssh"
KEY="$HOME_DIR/.ssh/qrstars_deploy"
if [[ ! -f "$KEY" ]]; then
  sudo -u "$AGENT_USER" ssh-keygen -t ed25519 -N "" -C "qrstars-insights@$(hostname)" -f "$KEY" >/dev/null
fi
if ! grep -q "qrstars_deploy" "$HOME_DIR/.ssh/config" 2>/dev/null; then
  cat >>"$HOME_DIR/.ssh/config" <<EOF
Host github.com
  IdentityFile $KEY
  IdentitiesOnly yes
EOF
  chown "$AGENT_USER:$AGENT_USER" "$HOME_DIR/.ssh/config"
  chmod 600 "$HOME_DIR/.ssh/config"
fi
sudo -u "$AGENT_USER" sh -c "ssh-keyscan -H github.com >> $HOME_DIR/.ssh/known_hosts 2>/dev/null"

# 3. Клон репозитория.
if [[ ! -d "$HOME_DIR/qrstars/.git" ]]; then
  if sudo -u "$AGENT_USER" git clone --quiet "$REPO_SSH" "$HOME_DIR/qrstars" 2>/dev/null; then
    echo "repo cloned to $HOME_DIR/qrstars"
  else
    echo
    echo "Добавьте deploy key (Read-only) в GitHub → Settings → Deploy keys и запустите скрипт ещё раз:"
    cat "$KEY.pub"
    echo
  fi
fi

# 4. Секрет для пакета данных (тот же INSIGHTS_DATA_SECRET, что в /opt/qrstars/.env).
ENV_FILE="$HOME_DIR/.qrstars-insights.env"
if [[ ! -f "$ENV_FILE" ]]; then
  secret="$(grep -E "^INSIGHTS_DATA_SECRET=" /opt/qrstars/.env 2>/dev/null | head -1 | cut -d= -f2- | tr -d "'\"" || true)"
  if [[ -z "$secret" ]]; then
    secret="$(openssl rand -hex 32)"
    echo "INSIGHTS_DATA_SECRET='$secret'" >>"$(readlink -f /opt/qrstars/.env)"
    echo "INSIGHTS_DATA_SECRET добавлен в /opt/qrstars/.env — перезапустите приложение (deploy.sh)"
  fi
  cat >"$ENV_FILE" <<EOF
INSIGHTS_DATA_SECRET='$secret'
INSIGHTS_DATA_URL='https://app.qrstars.ru/api/cron/insights-data'
EOF
  chown "$AGENT_USER:$AGENT_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

# Hermes-гейтвей как user-сервис должен жить без активной SSH-сессии.
loginctl enable-linger "$AGENT_USER" || true

echo "Готово. Дальше — шаги «Hermes» в $HOME_DIR/qrstars/deploy/insights-agent/README.md"
