#!/usr/bin/env bash
#
# Скачивание GeoLite2-City.mmdb (MaxMind) для локального GeoIP-лукупа.
#
# Требуется бесплатный лицензионный ключ MaxMind:
#   1. Зарегистрируйтесь на https://www.maxmind.com/en/geolite2/signup
#   2. Получите License Key в личном кабинете
#   3. Запустите: MAXMIND_LICENSE_KEY=xxxx ./scripts/download-geoip-db.sh
#
# Альтернатива: DB-IP (не требует ключа):
#   ./scripts/download-geoip-db.sh --provider dbip
#
# Файл сохраняется в data/GeoLite2-City.mmdb (путь можно переопределить через GEOIP_DB_PATH).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="${PROJECT_DIR}/data"
OUTPUT_FILE="${GEOIP_DB_PATH:-${OUTPUT_DIR}/GeoLite2-City.mmdb}"

mkdir -p "$OUTPUT_DIR"

PROVIDER="${1:-maxmind}"

if [[ "$PROVIDER" == "--provider" ]]; then
  PROVIDER="${2:-maxmind}"
fi

download_maxmind() {
  local key="${MAXMIND_LICENSE_KEY:-}"
  if [[ -z "$key" ]]; then
    echo "ERROR: Set MAXMIND_LICENSE_KEY env var."
    echo "  MAXMIND_LICENSE_KEY=xxxx $0"
    echo ""
    echo "Get a free key at: https://www.maxmind.com/en/geolite2/signup"
    exit 1
  fi

  echo "Downloading GeoLite2-City from MaxMind..."
  local tmpdir
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "$tmpdir"' EXIT

  # MaxMind download endpoint returns a .tar.gz containing the .mmdb
  curl -sfL \
    "https://download.maxmind.com/geoip/databases/GeoLite2-City/download?suffix=tar.gz" \
    -o "${tmpdir}/geoip.tar.gz" \
    -u "${key}:"

  tar -xzf "${tmpdir}/geoip.tar.gz" -C "$tmpdir"
  local mmdb
  mmdb="$(find "$tmpdir" -name "*.mmdb" | head -1)"

  if [[ -z "$mmdb" ]]; then
    echo "ERROR: .mmdb file not found in archive"
    exit 1
  fi

  mv "$mmdb" "$OUTPUT_FILE"
  echo "Saved to: $OUTPUT_FILE"
  echo "Size: $(du -h "$OUTPUT_FILE" | cut -f1)"
}

download_dbip() {
  echo "Downloading dbip-city-lite from DB-IP..."
  local tmpdir
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "$tmpdir"' EXIT

  # DB-IP free lite uses month-specific filenames
  local year_month
  year_month="$(date -u +%Y-%m)"
  local url="https://download.db-ip.com/free/dbip-city-lite-${year_month}.mmdb.gz"

  echo "URL: $url"
  curl -sfL "$url" -o "${tmpdir}/geoip.mmdb.gz"

  gunzip "${tmpdir}/geoip.mmdb.gz"
  mv "${tmpdir}/geoip.mmdb" "$OUTPUT_FILE"
  echo "Saved to: $OUTPUT_FILE"
  echo "Size: $(du -h "$OUTPUT_FILE" | cut -f1)"
}

case "$PROVIDER" in
  maxmind) download_maxmind ;;
  dbip)    download_dbip ;;
  *)
    echo "Unknown provider: $PROVIDER"
    echo "Usage: $0 [--provider maxmind|dbip]"
    exit 1
    ;;
esac
