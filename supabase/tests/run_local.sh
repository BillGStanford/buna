#!/usr/bin/env bash
# Applies every migration to a throwaway local Postgres and runs the RLS test suite.
# Usage: PGHOST=... ./supabase/tests/run_local.sh   (needs a superuser connection)
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=buna_test
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -v ON_ERROR_STOP=1 -q -d $DB -f supabase/tests/local_stub.sql
for f in supabase/migrations/*.sql; do
  echo "applying $f"
  psql -v ON_ERROR_STOP=1 -q -d $DB -f "$f"
done
psql -v ON_ERROR_STOP=1 -q -d $DB -f supabase/tests/rls_phase1.sql
psql -v ON_ERROR_STOP=1 -q -d $DB -f supabase/tests/rls_phase2.sql
psql -v ON_ERROR_STOP=1 -q -d $DB -f supabase/tests/rls_phase3.sql
psql -v ON_ERROR_STOP=1 -q -d $DB -f supabase/tests/rls_phase4.sql
psql -v ON_ERROR_STOP=1 -q -d $DB -f supabase/tests/rls_phase5.sql
psql -v ON_ERROR_STOP=1 -q -d $DB -f supabase/tests/rls_phase6.sql
psql -v ON_ERROR_STOP=1 -q -d $DB -f supabase/tests/rls_phase7.sql
psql -v ON_ERROR_STOP=1 -q -d $DB -f supabase/tests/rls_phase8.sql
psql -v ON_ERROR_STOP=1 -q -d $DB -f supabase/tests/rls_phase9.sql

echo "demo data: refuses without the flag, loads with it, clears completely"
OUT=$(psql -q -d $DB -f supabase/demo/seed.sql 2>&1 || true)
echo "$OUT" | grep -q "Refusing" || { echo "FAIL: demo seed ran without allow_demo"; exit 1; }
[ "$(psql -tA -d $DB -c "select count(*) from public.startups where is_demo")" = "0" ] || { echo "FAIL: demo rows loaded without flag"; exit 1; }
psql -v ON_ERROR_STOP=1 -q -d $DB -v allow_demo=1 -f supabase/demo/seed.sql
psql -v ON_ERROR_STOP=1 -q -d $DB -v allow_demo=1 -f supabase/demo/seed.sql   # idempotent
[ "$(psql -tA -d $DB -c "select count(*) from public.startups where is_demo")" = "8" ] || { echo "FAIL: expected 8 demo startups"; exit 1; }
[ "$(psql -tA -d $DB -c "select count(*) from public.launches where is_demo")" = "6" ] || { echo "FAIL: expected 6 demo launches"; exit 1; }
[ "$(psql -tA -d $DB -c "select count(*) from public.launches where is_demo and (vote_count <> 0 or comment_count <> 0)")" = "0" ] || { echo "FAIL: demo launches carry invented activity"; exit 1; }
[ "$(psql -tA -d $DB -c "select count(*) from public.opportunities where is_demo")" = "5" ] || { echo "FAIL: expected 5 demo opportunities"; exit 1; }
[ "$(psql -tA -d $DB -c "select count(*) from public.investors where is_demo and verification_status <> 'unverified'")" = "0" ] || { echo "FAIL: demo investors claim verification"; exit 1; }
[ "$(psql -tA -d $DB -c "select count(*) from public.startups where is_demo and verification_status <> 'unverified'")" = "0" ] || { echo "FAIL: demo data claims verification"; exit 1; }
psql -v ON_ERROR_STOP=1 -q -d $DB -f supabase/demo/clear.sql
[ "$(psql -tA -d $DB -c "select count(*) from public.startups where is_demo")" = "0" ] || { echo "FAIL: demo rows remain"; exit 1; }
[ "$(psql -tA -d $DB -c "select count(*) from public.launches where is_demo")" = "0" ] || { echo "FAIL: demo launches remain"; exit 1; }
[ "$(psql -tA -d $DB -c "select count(*) from public.opportunities where is_demo")" = "0" ] || { echo "FAIL: demo opportunities remain"; exit 1; }
[ "$(psql -tA -d $DB -c "select count(*) from public.investors where is_demo")" = "0" ] || { echo "FAIL: demo investors remain"; exit 1; }
[ "$(psql -tA -d $DB -c "select count(*) from public.startup_products where name like 'Ledgerly%'")" = "0" ] || { echo "FAIL: demo products remain"; exit 1; }
echo "ALL SQL CHECKS PASSED"
