#!/bin/sh
# Runtime entrypoint: apply pending migrations and (re-)seed stock before
# starting the inventory service. Both migrate and seed are idempotent
# (migrate no-ops with no pending migrations; seed upserts only), so
# running them on every boot is safe.
set -e

echo "Applying database migrations..."
/usr/local/bin/migrate

echo "Seeding stock..."
/usr/local/bin/seed

echo "Starting inventory service..."
exec /usr/local/bin/server
