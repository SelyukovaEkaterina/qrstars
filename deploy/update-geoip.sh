#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="/opt/qrstars/data"
DB_FILE="${GEOIP_DB_PATH:-${DATA_DIR}/GeoLite2-City.mmdb}"
YEAR_MONTH="$(date -u +%Y-%m)"
URL="https://download.db-ip.com/free/dbip-city-lite-${YEAR_MONTH}.mmdb.gz"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Downloading ${URL}..."
TMP="${DB_FILE}.tmp"

if curl -sfL "$URL" | gunzip > "$TMP"; then
  SIZE=$(stat -c%s "$TMP" 2>/dev/null || echo 0)
  if [ "$SIZE" -gt 1048576 ]; then
    mv "$TMP" "$DB_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] GeoIP updated: $(du -h "$DB_FILE" | cut -f1)"
  else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Downloaded file too small (${SIZE} bytes), aborting" >&2
    rm -f "$TMP"
    exit 1
  fi
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Download failed" >&2
  exit 1
fi
