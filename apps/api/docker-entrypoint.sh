#!/bin/sh
# Runtime entrypoint: apply pending migrations and (re-)seed before starting
# the API. The seed is idempotent (upserts only), so running it on every boot
# is safe.
set -e

export PATH="/repo/apps/api/node_modules/.bin:$PATH"

cd /repo/apps/api
echo "Applying database migrations..."
prisma migrate deploy

echo "Seeding database..."
prisma db seed

cd /repo
echo "Starting API..."
exec node apps/api/dist/main.js
