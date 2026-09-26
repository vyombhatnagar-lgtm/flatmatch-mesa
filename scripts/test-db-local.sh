#!/usr/bin/env bash
# Applies all migrations + seed to a throwaway local Postgres database and runs
# the RLS test suite. Usage: PGHOST=/tmp PGPORT=54329 PGUSER=postgres scripts/test-db-local.sh
set -euo pipefail
DB=${TEST_DB:-flatmatch_test}
P="psql -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "drop database if exists $DB" -c "create database $DB"
$P -d $DB -f supabase/tests/local_shim.sql
for f in supabase/migrations/*.sql; do echo "applying $f"; $P -d $DB -f "$f"; done
$P -d $DB -f supabase/seed.sql
$P -d $DB -f supabase/tests/rls_test.sql | grep -E "PASSED"
