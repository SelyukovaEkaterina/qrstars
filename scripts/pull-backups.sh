#!/bin/bash
# Забирает ночные бэкапы с VPS (deploy/pg-backup-local.sh) на этот Mac.
# Запускается launchd раз в день (~/Library/LaunchAgents/ru.qrstars.pull-backups.plist).
# Без --delete: старые дампы остаются здесь, даже когда сервер их уже удалил.
set -uo pipefail

HOST="${DEPLOY_HOST:-root@138.16.170.220}"
DEST="${QRSTARS_BACKUP_DIR:-$HOME/Backups/qrstars}"
mkdir -p "$DEST"

notify() { osascript -e "display notification \"$1\" with title \"QrStars бэкап\"" >/dev/null 2>&1 || true; }

if ! rsync -az -e "ssh -o BatchMode=yes -o ConnectTimeout=20" "$HOST:/var/backups/qrstars/" "$DEST/"; then
  echo "$(date '+%F %T') pull FAILED"
  notify "Не удалось скачать бэкап с сервера"
  exit 1
fi

# Свежесть: сервер пишет LAST_OK после каждого успешного ночного бэкапа.
last=$(stat -f %m "$DEST/LAST_OK" 2>/dev/null || echo 0)
age_h=$(( ($(date +%s) - last) / 3600 ))
if (( age_h > 36 )); then
  echo "$(date '+%F %T') pull ok, but server backup is ${age_h}h old"
  notify "Последний бэкап на сервере — ${age_h} ч назад"
  exit 1
fi

echo "$(date '+%F %T') pull ok: $(ls "$DEST/db" | tail -1), files $(du -sh "$DEST/files" | cut -f1)"
