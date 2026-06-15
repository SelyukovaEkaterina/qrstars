#!/usr/bin/env bash
# Daily PostgreSQL backup → private S3 (Beget) with tiered retention.
# Cron (03:00 MSK): 0 0 * * * /opt/qrstars/deploy/pg-backup.sh >> /var/log/qrstars-pg-backup.log 2>&1
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.prod.yml"
ENV_FILE="$SCRIPT_DIR/.env"

RETENTION_DAILY="${BACKUP_RETENTION_DAILY:-7}"
RETENTION_WEEKLY="${BACKUP_RETENTION_WEEKLY:-5}"
RETENTION_MONTHLY="${BACKUP_RETENTION_MONTHLY:-12}"
S3_PREFIX="${BACKUP_S3_PREFIX:-postgres}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
die() { log "ERROR: $*" >&2; exit 1; }

if [[ ! -f "$ENV_FILE" ]]; then
  die ".env not found at $ENV_FILE"
fi

# shellcheck disable=SC1090
set -a && source "$ENV_FILE" && set +a

: "${POSTGRES_USER:=qrstars}"
: "${POSTGRES_DB:=smartreview}"
: "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
: "${BACKUP_S3_ACCESS_KEY:?BACKUP_S3_ACCESS_KEY is required}"
: "${BACKUP_S3_SECRET_KEY:?BACKUP_S3_SECRET_KEY is required}"

AWS_IMAGE="${BACKUP_AWS_CLI_IMAGE:-amazon/aws-cli:2.22.0}"
DATE="$(TZ=Europe/Moscow date +%Y-%m-%d)"
MONTH="$(TZ=Europe/Moscow date +%Y-%m)"
DOW="$(TZ=Europe/Moscow date +%u)"   # 7 = Sunday
DOM="$(TZ=Europe/Moscow date +%d)" # 01 = first day of month

WORKDIR="$(mktemp -d)"
DUMP="$WORKDIR/${POSTGRES_DB}.sql.gz"
trap 'rm -rf "$WORKDIR"' EXIT

log "pg_dump → $DUMP (db=$POSTGRES_DB user=$POSTGRES_USER)"
cd "$SCRIPT_DIR"
docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl --format=plain \
  | gzip -9 > "$DUMP"

BYTES="$(wc -c < "$DUMP" | tr -d ' ')"
[[ "$BYTES" -gt 1024 ]] || die "dump too small ($BYTES bytes) — aborting upload"

log "dump size: $(numfmt --to=iec-i --suffix=B "$BYTES" 2>/dev/null || echo "${BYTES}B")"

aws_s3() {
  docker run --rm \
    -e AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" \
    -e AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" \
    -e AWS_DEFAULT_REGION="${BACKUP_S3_REGION:-ru1}" \
    -v "$WORKDIR:/backup:ro" \
    "$AWS_IMAGE" \
    --endpoint-url "$BACKUP_S3_ENDPOINT" \
    s3 "$@"
}

upload() {
  local tier="$1"
  local key="$2"
  local remote="s3://${BACKUP_S3_BUCKET}/${S3_PREFIX}/${tier}/${key}"
  log "upload → $remote"
  aws_s3 cp "/backup/$(basename "$DUMP")" "$remote" \
    --content-type "application/gzip" \
    --metadata "db=${POSTGRES_DB},date=${DATE},tier=${tier}"
}

prune_tier() {
  local tier="$1"
  local keep="$2"
  local remote="s3://${BACKUP_S3_BUCKET}/${S3_PREFIX}/${tier}/"

  mapfile -t keys < <(
    docker run --rm \
      -e AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" \
      -e AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" \
      -e AWS_DEFAULT_REGION="${BACKUP_S3_REGION:-ru1}" \
      "$AWS_IMAGE" \
      --endpoint-url "$BACKUP_S3_ENDPOINT" \
      s3 ls "$remote" \
      | awk '{print $4}' \
      | sort
  )

  local total="${#keys[@]}"
  if (( total <= keep )); then
    log "retention $tier: $total file(s), keep $keep — nothing to prune"
    return 0
  fi

  local remove=$((total - keep))
  log "retention $tier: $total file(s), removing oldest $remove"
  for ((i = 0; i < remove; i++)); do
    local obj="${keys[i]}"
    log "  delete s3://${BACKUP_S3_BUCKET}/${S3_PREFIX}/${tier}/${obj}"
    aws_s3 rm "s3://${BACKUP_S3_BUCKET}/${S3_PREFIX}/${tier}/${obj}"
  done
}

# --- uploads ---
upload daily "${DATE}.sql.gz"
upload latest "latest.sql.gz"

if [[ "$DOW" == "7" ]]; then
  upload weekly "${DATE}.sql.gz"
fi

if [[ "$DOM" == "01" ]]; then
  upload monthly "${MONTH}.sql.gz"
fi

# --- rotation (oldest first, keep N newest) ---
prune_tier daily "$RETENTION_DAILY"
prune_tier weekly "$RETENTION_WEEKLY"
prune_tier monthly "$RETENTION_MONTHLY"

log "backup complete"
