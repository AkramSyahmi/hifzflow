#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Applies every migration and the Quran seed to a scratch database, then runs
# the SQL test suite against it.
#
# Requires a reachable PostgreSQL 15+ with the btree_gist extension available.
# Configure with PGHOST / PGPORT / PGUSER, or point DATABASE_URL at a server.
#
#   pnpm db:test
# ---------------------------------------------------------------------------
set -euo pipefail

DB_NAME="${DB_NAME:-hifzflow_test}"
PSQL_BASE=(psql -v ON_ERROR_STOP=1 --quiet --no-psqlrc)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Recreating ${DB_NAME}"
"${PSQL_BASE[@]}" -d postgres -c "drop database if exists ${DB_NAME};" >/dev/null
"${PSQL_BASE[@]}" -d postgres -c "create database ${DB_NAME};" >/dev/null

run() {
  "${PSQL_BASE[@]}" -d "${DB_NAME}" -f "$1"
}

echo "Applying local Supabase shim"
run "${ROOT}/supabase/tests/00_local_shim.sql" >/dev/null

echo "Applying migrations"
for migration in "${ROOT}"/supabase/migrations/*.sql; do
  echo "  $(basename "${migration}")"
  run "${migration}" >/dev/null
done

echo "Verifying seed checksum"
(
  cd "${ROOT}/supabase/seed"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum -c quran_reference.sha256
  else
    shasum -a 256 -c quran_reference.sha256
  fi
)

echo "Loading Quran reference data"
run "${ROOT}/supabase/seed/quran_reference.sql" >/dev/null

echo "Loading test helpers"
run "${ROOT}/supabase/tests/helpers.sql" >/dev/null

echo
for suite in "${ROOT}"/supabase/tests/*.test.sql; do
  run "${suite}"
done

echo
echo "All database tests passed."
