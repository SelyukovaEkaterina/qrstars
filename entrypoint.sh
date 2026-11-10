#!/bin/sh
set -e

echo "Running migrations..."

# Resolve any migrations that were previously marked as failed so they can be retried.
# All migration SQLs use IF NOT EXISTS / IF EXISTS making them safe to re-apply.
npx prisma migrate resolve --rolled-back 20260524200000_add_menu_order 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260525130000_add_pd_consent_fields 2>/dev/null || true

npx prisma migrate deploy

# Seed создаёт демо-аккаунты с известными паролями (в т.ч. ADMIN) — на чистой прод-базе
# это открытая админка. На проде SKIP_SEED=1 в /opt/qrstars/.env.
if [ "${SKIP_SEED:-}" = "1" ]; then
  echo "Seed skipped (SKIP_SEED=1)."
elif ! npx prisma db seed; then
  if [ "${NODE_ENV:-}" = "production" ]; then
    echo "Seed skipped (already applied or non-fatal in production)."
  else
    exit 1
  fi
fi

echo "Starting application..."
exec npm run start
