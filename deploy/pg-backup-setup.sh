#!/usr/bin/env bash
# One-time VPS setup: env vars for backup S3 + cron job (03:00 MSK daily).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
CRON_LINE='0 0 * * * /opt/qrstars/deploy/pg-backup.sh >> /var/log/qrstars-pg-backup.log 2>&1'
MARKER='# qrstars-pg-backup'

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

chmod +x "$SCRIPT_DIR/pg-backup.sh" "$SCRIPT_DIR/pg-restore.sh"

if ! grep -q '^BACKUP_S3_ENDPOINT=' "$ENV_FILE" 2>/dev/null; then
  cat >>"$ENV_FILE" <<'EOF'

# PostgreSQL backups → private S3 (deploy/pg-backup.sh)
BACKUP_S3_ENDPOINT=https://s3.ru1.storage.beget.cloud
BACKUP_S3_BUCKET=1919a3d97e3e-private
BACKUP_S3_REGION=ru1
BACKUP_S3_ACCESS_KEY=CHANGE_ME
BACKUP_S3_SECRET_KEY=CHANGE_ME
BACKUP_S3_PREFIX=postgres
BACKUP_RETENTION_DAILY=7
BACKUP_RETENTION_WEEKLY=5
BACKUP_RETENTION_MONTHLY=12
EOF
  log "Added BACKUP_S3_* placeholders to $ENV_FILE — set real keys before first run"
else
  log "BACKUP_S3_* already present in $ENV_FILE"
fi

touch /var/log/qrstars-pg-backup.log
chmod 640 /var/log/qrstars-pg-backup.log

TMP_CRON="$(mktemp)"
crontab -l 2>/dev/null | grep -v "$MARKER" | grep -v 'pg-backup.sh' >"$TMP_CRON" || true
echo "$CRON_LINE $MARKER" >>"$TMP_CRON"
crontab "$TMP_CRON"
rm -f "$TMP_CRON"

log "cron installed: $CRON_LINE"
log "test run: bash $SCRIPT_DIR/pg-backup.sh"
