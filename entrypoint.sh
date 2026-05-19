#!/bin/sh
set -e

echo "Running migrations..."
npx prisma migrate deploy

echo "Seeding database..."
if ! npx prisma db seed; then
  if [ "${NODE_ENV:-}" = "production" ]; then
    echo "Seed skipped (already applied or non-fatal in production)."
  else
    exit 1
  fi
fi

echo "Starting application..."
exec npm run start
