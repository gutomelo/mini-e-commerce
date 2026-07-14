#!/bin/sh
# Runtime entrypoint: ensure the payment database exists, then start the
# Spring Boot app. Flyway (wired into the app itself) can only migrate
# schema inside a database that already exists -- it cannot create the
# database -- so that one-time bootstrap step has to happen here, before
# `java -jar` ever runs, using the psql client against Postgres's own
# "postgres" maintenance database. This mirrors apps/inventory's Go
# `cmd/migrate` `ensureDatabaseExists` (check-then-create via
# `SELECT 1 FROM pg_database WHERE datname = $1`, then `CREATE DATABASE`),
# translated to shell since there is no separate Go/Node binary here.
set -e

# PAYMENT_DATABASE_URL is a JDBC URL, e.g.:
#   jdbc:postgresql://postgres:5432/mini_ecommerce_payment?user=postgres&password=postgres
# psql/libpq do not understand the jdbc: scheme or its query-string style
# credentials, so we parse the pieces we need (host, port, database name,
# user, password) out of it with plain shell parameter expansion rather
# than pulling in a JDBC-aware tool. This is a bit fiddly but keeps the
# runtime image to "java + psql" with no extra language/runtime.
url="${PAYMENT_DATABASE_URL#jdbc:postgresql://}"

host_port="${url%%/*}"
db_host="${host_port%%:*}"
db_port="${host_port##*:}"

path_and_query="${url#*/}"
db_name="${path_and_query%%\?*}"
query="${path_and_query#*\?}"

db_user="postgres"
db_password=""

old_ifs="$IFS"
IFS='&'
for kv in $query; do
  key="${kv%%=*}"
  value="${kv#*=}"
  case "$key" in
    user) db_user="$value" ;;
    password) db_password="$value" ;;
  esac
done
IFS="$old_ifs"

export PGHOST="$db_host"
export PGPORT="$db_port"
export PGUSER="$db_user"
export PGPASSWORD="$db_password"

echo "Ensuring database exists..."

exists=$(psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${db_name}'")
if [ "$exists" != "1" ]; then
  psql -d postgres -c "CREATE DATABASE \"${db_name}\""
fi

echo "Starting payment service..."
exec java -jar /app/app.jar
