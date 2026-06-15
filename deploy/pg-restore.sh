#!/usr/bin/env bash
# Restore PostgreSQL from a backup in private S3.
# Usage:
#   ./pg-restore.sh                          # latest
#   ./pg-restore.sh daily/2026-06-12.sql.gz
#   ./pg-restore.sh weekly/2026-06-08.sql.gz
#   ./pg-restore.sh monthly/2026-06.sql.gz
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.prod.yml"
ENV_FILE="$SCRIPT_DIR/.env"

S3_PREFIX="${BACKUP_S3_PREFIX:-postgres}"
OBJECT_KEY="${1:-latest/latest.sql.gz}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
die() { log "ERROR: $*" >&2; exit 1; }

[[ -f "$ENV_FILE" ]] || die ".env not found at $ENV_FILE"
# shellcheck disable=SC1090
set -a && source "$ENV_FILE" && set +a

: "${POSTGRES_USER:=qrstars}"
: "${POSTGRES_DB:=smartreview}"
: "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
: "${BACKUP_S3_ACCESS_KEY:?BACKUP_S3_ACCESS_KEY is required}"
: "${BACKUP_S3_SECRET_KEY:?BACKUP_S3_SECRET_KEY is required}"

AWS_IMAGE="${BACKUP_AWS_CLI_IMAGE:-amazon/aws-cli:2.22.0}"
REMOTE="s3://${BACKUP_S3_BUCKET}/${S3_PREFIX}/${OBJECT_KEY}"

WORKDIR="$(mktemp -d)"
DUMP="$WORKDIR/restore.sql.gz"
trap 'rm -rf "$WORKDIR"' EXIT

log "download $REMOTE"
docker run --rm \
  -e AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" \
  -e AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" \
  -e AWS_DEFAULT_REGION="${BACKUP_S3_REGION:-ru1}" \
  -v "$WORKDIR:/backup" \
  "$AWS_IMAGE" \
  --endpoint-url "$BACKUP_S3_ENDPOINT" \
  s3 cp "$REMOTE" "/backup/restore.sql.gz"

[[ -s "$DUMP" ]] || die "downloaded file is empty"

log "WARNING: this will REPLACE all data in database '$POSTGRES_DB'"
read -r -p "Type RESTORE to continue: " confirm
[[ "$confirm" == "RESTORE" ]] || die "aborted"

log "restoring into db container..."
cd "$SCRIPT_DIR"
gunzip -c "$DUMP" | docker compose -f "$COMPOSE_FILE" exec -T db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1

log "restore complete from $OBJECT_KEY"
