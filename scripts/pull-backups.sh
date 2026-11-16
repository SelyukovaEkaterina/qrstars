#!/bin/bash
# Забирает ночные бэкапы с VPS (deploy/pg-backup-local.sh) на этот Mac.
# launchd запускает его при входе и каждый час (~/Library/LaunchAgents/ru.qrstars.pull-backups.plist):
# если сегодня копия уже скачана — выходит сразу, так что выключенный ноут или
# упавший запуск догоняются в течение часа после включения.
# Без --delete: старые дампы остаются здесь, даже когда сервер их уже удалил.
set -uo pipefail

HOST="${DEPLOY_HOST:-root@138.16.170.220}"
DEST="${QRSTARS_BACKUP_DIR:-$HOME/Backups/qrstars}"
mkdir -p "$DEST"

notify() { osascript -e "display notification \"$1\" with title \"QrStars бэкап\"" >/dev/null 2>&1 || true; }

TODAY=$(date +%F)
STATE="$DEST/.last-pull-ok"
# FORCE=1 — скачать ещё раз, даже если сегодня уже скачано.
if [[ "${FORCE:-}" != "1" && "$(cat "$STATE" 2>/dev/null)" == "$TODAY" ]]; then
  exit 0
fi

# Ошибку показываем не чаще раза в день: запусков теперь до 24 в сутки.
notify_once() {
  local flag="$DEST/.last-notify"
  [[ "$(cat "$flag" 2>/dev/null)" == "$TODAY" ]] && return
  echo "$TODAY" > "$flag"
  notify "$1"
}

if ! rsync -az -e "ssh -o BatchMode=yes -o ConnectTimeout=20" "$HOST:/var/backups/qrstars/" "$DEST/"; then
  echo "$(date '+%F %T') pull FAILED"
  notify_once "Не удалось скачать бэкап с сервера, попробую через час"
  exit 1
fi

# Свежесть: сервер пишет LAST_OK после каждого успешного ночного бэкапа.
last=$(stat -f %m "$DEST/LAST_OK" 2>/dev/null || echo 0)
age_h=$(( ($(date +%s) - last) / 3600 ))
if (( age_h > 36 )); then
  echo "$(date '+%F %T') pull ok, but server backup is ${age_h}h old"
  notify_once "Последний бэкап на сервере — ${age_h} ч назад"
  exit 1
fi

# День закрыт, только когда скачан сегодняшний ночной бэкап (сервер делает его в 03:00):
# запуск после полуночи до 03:00 взял вчерашний и через час попробует снова.
if [[ "$(date -r "$last" +%F)" == "$TODAY" ]]; then
  echo "$TODAY" > "$STATE"
fi
echo "$(date '+%F %T') pull ok: $(ls "$DEST/db" | tail -1), files $(du -sh "$DEST/files" | cut -f1)"
