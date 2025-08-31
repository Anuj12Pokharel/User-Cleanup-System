#!/bin/sh
set -e

# Optional: Wait for database to be available before starting the app.
# To enable, set env var WAIT_FOR_DB=1 and provide DB_HOST and DB_PORT in env.
if [ "${WAIT_FOR_DB:-0}" = "1" ]; then
  DB_HOST="${DB_HOST:-db}"
  DB_PORT="${DB_PORT:-5432}"
  echo "Waiting for database ${DB_HOST}:${DB_PORT}..."
  until nc -z "$DB_HOST" "$DB_PORT"; do
    sleep 1
  done
  echo "Database is available."
fi

# Exec the container's main process (what's in CMD or overridden by compose)
exec "$@"
