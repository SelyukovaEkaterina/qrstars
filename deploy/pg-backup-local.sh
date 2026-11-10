#!/bin/bash
# Ночной бэкап на диск VPS (cron 03:00 МСК, crontab: pg-backup-local.sh):
#   /var/backups/qrstars/db/YYYY-MM-DD.sql.gz — дамп базы, хранится BACKUP_KEEP_DAYS (14) дней
#   /var/backups/qrstars/files/qrstars/      — файлы MinIO обычными файлами (mc mirror)
#   /var/backups/qrstars/LAST_OK             — время последнего успешного бэкапа
# Вне сервера копию забирает ноутбук владельца: scripts/pull-backups.sh (launchd, раз в день).
# Восстановление базы: gunzip -c YYYY-MM-DD.sql.gz | docker exec -i deploy-db-1 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
# Восстановление файлов: залить папку files/qrstars в бакет (mc mirror в обратную сторону).
set -euo pipefail

DIR=/var/backups/qrstars
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
STAMP=$(date +%Y-%m-%d)

mkdir -p "$DIR/db" "$DIR/files"
# Папку files пишет контейнер MinIO (uid 1001), смонтирована в него как /backup.
chown 1001:1001 "$DIR/files"

TMP="$DIR/db/.$STAMP.sql.gz.tmp"
docker exec deploy-db-1 sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' | gzip -9 > "$TMP"
gzip -t "$TMP"
mv "$TMP" "$DIR/db/$STAMP.sql.gz"
find "$DIR/db" -name '*.sql.gz' -mtime +"$KEEP_DAYS" -delete

# Бакет qrstars — как S3_BUCKET в .env и proxy_pass /storage/ в nginx.
docker exec deploy-minio-1 sh -c '
  mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null &&
  if mc ls local/qrstars >/dev/null 2>&1; then mc mirror --overwrite --remove --quiet local/qrstars /backup/qrstars; fi'

date '+%F %T %Z' > "$DIR/LAST_OK"
echo "$(date '+%F %T') backup ok: db $(du -h "$DIR/db/$STAMP.sql.gz" | cut -f1), files $(du -sh "$DIR/files" | cut -f1)"
