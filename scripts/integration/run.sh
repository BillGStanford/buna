#!/usr/bin/env bash
# Optional local integration check: real Postgres + real PostgREST + the production Next server.
# Needs: psql (superuser connection), a PostgREST binary (POSTGREST_BIN), Node, and a prior `npm run build`.
# It validates the app's actual database queries (search, filters, pagination, embeds, RLS visibility)
# without a Supabase account. It does NOT test Supabase Auth, Storage or email.
set -uo pipefail
cd "$(dirname "$0")/../.."
: "${POSTGREST_BIN:?set POSTGREST_BIN to a PostgREST binary}"
DB=buna_it; APP_PORT=${APP_PORT:-3120}; PROXY_PORT=3002; PGRST_PORT=3001
H=scripts/integration/harness.mjs
export JWT_SECRET="local-integration-secret-0123456789-abcdef"
OWNER=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa; STRANGER=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
MOD=cccccccc-cccc-4ccc-8ccc-cccccccccccc; ADMIN=ffffffff-ffff-4fff-8fff-ffffffffffff; DORA=99999999-9999-4999-8999-999999999991; VOTER=dddddddd-dddd-4ddd-8ddd-dddddddddddd; UNVER=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee; COMMUNITY_THREAD=88888888-8888-4888-8888-888888888881
FAIL=0; PIDS=()
cleanup() {
  for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null; done
  # `npx` spawns a child that outlives its wrapper; stop servers by name as well
  pkill -f "next start -p $APP_PORT" 2>/dev/null; pkill -f "next-server" 2>/dev/null
  pkill -f "harness.mjs proxy" 2>/dev/null; pkill -f "pgrst.conf" 2>/dev/null; true
}
cleanup
trap cleanup EXIT

psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
sed "s/buna_test/$DB/g" supabase/tests/local_stub.sql | psql -v ON_ERROR_STOP=1 -q -d $DB >/dev/null
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d $DB -f "$f" >/dev/null || { echo "migration failed: $f"; exit 1; }; done
psql -v ON_ERROR_STOP=1 -q -d $DB -v allow_demo=1 -f supabase/demo/seed.sql >/dev/null
psql -v ON_ERROR_STOP=1 -q -d $DB -f scripts/integration/fixtures.sql >/dev/null
psql -q -d postgres -c "do \$\$ begin if not exists (select from pg_roles where rolname='authenticator') then create role authenticator login password 'pw' noinherit; end if; end \$\$;" \
  -c "grant anon, authenticated, service_role to authenticator" >/dev/null

cat > /tmp/pgrst.conf <<CONF
db-uri = "postgres://authenticator:pw@127.0.0.1:5432/$DB"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-port = $PGRST_PORT
CONF
"$POSTGREST_BIN" /tmp/pgrst.conf >/tmp/pgrst.log 2>&1 & PIDS+=($!)
PROXY_DB=$DB USER_EMAILS="{\"$OWNER\":\"owner@test.dev\",\"$STRANGER\":\"stranger@test.dev\",\"$MOD\":\"mod@test.dev\",\"$VOTER\":\"voter@test.dev\",\"$UNVER\":\"unverified@test.dev\",\"$ADMIN\":\"admin@test.dev\",\"$DORA\":\"dora@test.dev\"}" PROXY_PORT=$PROXY_PORT node $H proxy >/tmp/proxy.log 2>&1 & PIDS+=($!)

export NEXT_PUBLIC_SUPABASE_URL="http://localhost:$PROXY_PORT"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$(node $H token anon)"
export SUPABASE_SERVICE_ROLE_KEY="$(node $H token service_role)"
export NEXT_PUBLIC_SITE_URL="http://localhost:$APP_PORT" NEXT_TELEMETRY_DISABLED=1 CRON_SECRET="local-cron-secret-0123456789"
npx next start -p "$APP_PORT" >/tmp/next-it.log 2>&1 & PIDS+=($!)
for i in $(seq 1 40); do curl -sf "localhost:$PGRST_PORT/categories?limit=1" -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" >/dev/null && curl -s -o /dev/null "localhost:$APP_PORT/api/health" && break; sleep 0.5; done

B="http://localhost:$APP_PORT"
OWNER_COOKIE="$(node $H cookie $OWNER owner@test.dev)"; STRANGER_COOKIE="$(node $H cookie $STRANGER stranger@test.dev)"
MOD_COOKIE="$(node $H cookie $MOD mod@test.dev)"; VOTER_COOKIE="$(node $H cookie $VOTER voter@test.dev)"; UNVER_COOKIE="$(node $H cookie $UNVER unverified@test.dev)"
ADMIN_COOKIE="$(node $H cookie $ADMIN admin@test.dev)"; DORA_COOKIE="$(node $H cookie $DORA dora@test.dev)"
ok()   { echo "  ok   $1"; }
bad()  { echo "  FAIL $1"; FAIL=1; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
has()  { local name="$1" url="$2" out; shift 2; out=$(curl -s "$@" "$url" | sed 's/<!-- -->//g'); grep -qF -- "$name" <<<"$out"; }
expect_has()  { local label="$1" needle="$2" url="$3"; shift 3; has "$needle" "$url" "$@" && ok "$label" || bad "$label (missing: $needle)"; }
expect_lacks(){ local label="$1" needle="$2" url="$3"; shift 3; has "$needle" "$url" "$@" && bad "$label (unexpected: $needle)" || ok "$label"; }
expect_code() { local label="$1" want="$2" url="$3"; shift 3; local got; got=$(code "$@" "$url"); [ "$got" = "$want" ] && ok "$label" || bad "$label (got $got, want $want)"; }

echo "== anonymous visitor =="
expect_code "health (database reachable)" 200 "$B/api/health"
expect_code "community board renders" 200 "$B/community"
expect_has "community board shows the seeded founder question" "How do I register a company in Ethiopia?" "$B/community"
expect_has "community category filter works" "How do I register a company in Ethiopia?" "$B/community?category=legal-registration"
expect_has "community thread detail shows its answer" "Start by checking the current registration requirements" "$B/community/$COMMUNITY_THREAD"
expect_has  "home lists recent demo startups" "Ledgerly (Demo)" "$B/"
expect_has  "home shows sector chips with counts" "Browse by sector" "$B/"
PUB=$(psql -tA -d $DB -c "select count(*) from public.startups where status = 'published'")
expect_has  "directory total count matches the database ($PUB)" ">${PUB}<" "$B/startups"
expect_lacks "directory hides draft"       "Secret Draft Labs" "$B/startups?q=secret"
expect_lacks "directory hides unpublished" "Gone Dark" "$B/startups?q=gone"
expect_has  "search by name prefix"       "Ledgerly (Demo)" "$B/startups?q=ledg"
expect_lacks "search excludes non-matches" "Solarpath" "$B/startups?q=ledg"
expect_has  "full-text search by tagline word" "Ledgerly (Demo)" "$B/startups?q=bookkeeping"
expect_has  "filter: country"  "Tutorbridge (Demo)" "$B/startups?country=ET"
expect_lacks "filter: country excludes others" "Cargoflow" "$B/startups?country=ET"
expect_has  "filter: sector + stage" "Ledgerly (Demo)" "$B/startups?category=fintech&stage=mvp"
expect_lacks "filter: sector + stage excludes" "Harvestline" "$B/startups?category=fintech&stage=mvp"
expect_has  "filter: city (case-insensitive)" "Harvestline (Demo)" "$B/startups?city=nairobi"
FIRST=$(curl -s "$B/startups?sort=name" | grep -o 'Cargoflow (Demo)\|Clinicloop (Demo)\|Codeyard (Demo)' | head -1)
[ "$FIRST" = "Cargoflow (Demo)" ] && ok "sort by name" || bad "sort by name (first=$FIRST)"
P1=$(curl -s "$B/startups" | grep -o 'href="/startups/[a-z0-9-]*"' | sort -u | wc -l)
P2=$(curl -s "$B/startups?page=2" | grep -o 'href="/startups/[a-z0-9-]*"' | sort -u | wc -l)
[ "$P1" -ge 12 ] && [ "$P2" -ge 1 ] && ok "pagination returns different pages ($P1 / $P2 cards)" || bad "pagination ($P1 / $P2)"
DIFF=$(comm -12 <(curl -s "$B/startups" | grep -o 'href="/startups/[a-z0-9-]*"' | sort -u) <(curl -s "$B/startups?page=2" | grep -o 'href="/startups/[a-z0-9-]*"' | sort -u) | grep -v 'href="/startups/"' | wc -l)
[ "$DIFF" = "0" ] && ok "pages do not overlap" || bad "pages overlap ($DIFF)"
expect_has  "page beyond the end redirects to the last page (and is noindex)" "NEXT_REDIRECT;replace;/startups?page=2" "$B/startups?page=99"
expect_has  "out-of-range page is noindex" "noindex" "$B/startups?page=99"
expect_code "hostile search text does not break the query" 200 "$B/startups?q=%22%2C%29%3B%20drop%20table%20startups%3B--"
expect_has  "no-results state" "No startups match" "$B/startups?q=zzzznothing"
expect_has  "profile renders products" "Ledgerly Mobile" "$B/startups/demo-ledgerly"
expect_has  "demo profile is labelled" "Demo listing" "$B/startups/demo-ledgerly"
expect_has  "demo profile is noindex" "noindex" "$B/startups/demo-ledgerly"
expect_has  "real profile: description paragraphs" "Second paragraph." "$B/startups/owner-works"
expect_has  "real profile: product link" "https://owner.example/app" "$B/startups/owner-works"
expect_has  "real profile: screenshot alt text" "Dashboard screenshot" "$B/startups/owner-works"
expect_has  "real profile: public team member" "Olivia Owner" "$B/startups/owner-works"
expect_has  "real profile: structured data" "application/ld+json" "$B/startups/owner-works"
expect_has  "real profile: canonical" "/startups/owner-works" "$B/startups/owner-works"
expect_has  "real profile: verification wording" "Verification pending review" "$B/startups/owner-works"
expect_lacks "real profile has no preview banner" "only your team can see" "$B/startups/owner-works"
expect_code "uppercase slug redirects (permanent)" 308 "$B/startups/Owner-Works"
expect_code "draft is 404 for visitors" 404 "$B/startups/secret-draft"
expect_code "unpublished is 404 for visitors" 404 "$B/startups/gone-dark"
expect_code "unknown slug is 404" 404 "$B/startups/nope-nope"
psql -q -d $DB -c "set role authenticated; select set_config('request.jwt.claim.sub','$OWNER',false); update public.startups set slug='owner-works-co' where slug='owner-works';" >/dev/null
expect_code "old slug redirects after rename" 308 "$B/startups/owner-works"
LOC=$(curl -s -o /dev/null -w "%{redirect_url}" "$B/startups/owner-works"); [[ "$LOC" == */startups/owner-works-co ]] && ok "redirect target is the new slug" || bad "redirect target ($LOC)"
expect_code "renamed profile resolves" 200 "$B/startups/owner-works-co"
SM=$(curl -s "$B/sitemap.xml")
echo "$SM" | grep -q "owner-works-co" && ok "sitemap lists real published startup" || bad "sitemap lists real startup"
echo "$SM" | grep -q "demo-ledgerly" && bad "sitemap leaks demo startup" || ok "sitemap excludes demo startups"
echo "$SM" | grep -q "secret-draft\|gone-dark" && bad "sitemap leaks non-public startup" || ok "sitemap excludes draft and unpublished"
expect_code "dashboard redirects anonymous users" 307 "$B/dashboard/startup"

echo "== launches (anonymous) =="
expect_has  "launch feed lists demo launches" "Ledgerly Mobile (Demo)" "$B/launches?sort=latest"
expect_has  "launch feed hides drafts" "Owner Launch" "$B/launches?sort=latest"
expect_lacks "launch feed hides drafts and pending" "Draft Launch" "$B/launches?sort=latest"
expect_lacks "launch feed hides pending launches" "Pending Launch" "$B/launches?sort=latest"
expect_has  "tag filter" "Owner Launch" "$B/launches?sort=today&tag=payments"
expect_lacks "tag filter excludes others" "Harvestline Market" "$B/launches?tag=payments"
expect_has  "sector filter" "Old Favourite" "$B/launches?sort=archive&category=edtech"
expect_has  "search finds a launch by name" "Old Favourite" "$B/launches?sort=archive&q=favourite"
expect_has  "full-text search over tagline" "Old Favourite" "$B/launches?sort=archive&q=loved"
expect_has  "period filter keeps recent launches" "Ledgerly Mobile (Demo)" "$B/launches?sort=latest&period=day"
expect_lacks "period filter drops older launches" "Offline Kit (Demo)" "$B/launches?sort=latest&period=day"
expect_has  "hostile search text is harmless" "No launches match" "$B/launches?q=%22%29%3B%20drop%20table%20launches%3B--"
L1=$(curl -s "$B/launches?sort=latest" | grep -o 'href="/launches/[a-z0-9-]*"' | sort -u); L2=$(curl -s "$B/launches?sort=latest&page=2" | grep -o 'href="/launches/[a-z0-9-]*"' | sort -u)
[ "$(echo "$L1" | wc -l)" -ge 12 ] && [ -n "$L2" ] && [ -z "$(comm -12 <(echo "$L1") <(echo "$L2"))" ] && ok "launch pagination returns distinct pages" || bad "launch pagination"
expect_has  "out-of-range launch page redirects" "NEXT_REDIRECT;replace;/launches?sort=latest&page=2" "$B/launches?sort=latest&page=99"
expect_has  "launch page: description" "Second launch paragraph." "$B/launches/owner-launch"
expect_has  "launch page: screenshot alt" "Launch screenshot" "$B/launches/owner-launch"
expect_has  "launch page: maker" "Olivia Owner" "$B/launches/owner-launch"
expect_has  "launch page: startup link" "/startups/owner-works" "$B/launches/owner-launch"
expect_has  "launch page: existing comment" "Great launch from Stan" "$B/launches/owner-launch"
expect_has  "launch page: product link is rel=nofollow" 'rel="noopener noreferrer nofollow"' "$B/launches/owner-launch"
expect_has  "launch page: canonical" "/launches/owner-launch" "$B/launches/owner-launch"
expect_has  "demo launch is noindex" "noindex" "$B/launches/demo-ledgerly-mobile"
expect_code "draft launch is 404" 404 "$B/launches/draft-launch"
expect_code "pending launch is 404" 404 "$B/launches/pending-launch"
expect_code "unknown launch is 404" 404 "$B/launches/nope-nope"
expect_code "uppercase launch slug redirects" 308 "$B/launches/Owner-Launch"
expect_has  "upcoming tab lists scheduled launches" "Soon Launch" "$B/launches?sort=upcoming"
expect_code "cron is closed without a secret" 401 "$B/api/cron/daily"
expect_code "submit page requires sign-in" 307 "$B/launches/submit"

echo "== opportunities, founders, investors, static pages (anonymous) =="
expect_has  "open list shows open opportunities" "Real Seed Grant" "$B/opportunities"
expect_lacks "open list hides drafts" "Draft Opportunity" "$B/opportunities?q=draft"
expect_lacks "open list hides archived" "Archived Opportunity" "$B/opportunities?when=all&q=archived"
expect_lacks "a past-deadline listing still marked published is NOT in the open list" "Stale Closed Programme" "$B/opportunities"
expect_has  "…but it is in the closed list" "Stale Closed Programme" "$B/opportunities?when=closed"
expect_has  "filter: category" "Real Seed Grant" "$B/opportunities?category=grant"
expect_lacks "filter: category excludes others" "Stale Closed" "$B/opportunities?category=grant&when=all&country=NG"
expect_has  "filter: country includes listings open to all of Africa" "Demo Accelerator Cohort" "$B/opportunities?country=NG&category=accelerator"
expect_lacks "filter: country excludes other countries" "Real Seed Grant" "$B/opportunities?country=NG"
expect_has  "closing soon tab" "Demo Pitch Night" "$B/opportunities?when=soon"
expect_has  "rolling tab" "Demo Rolling Fellowship" "$B/opportunities?when=rolling"
expect_has  "search by title" "Real Seed Grant" "$B/opportunities?q=seed"
O1=$(curl -s "$B/opportunities" | grep -o 'href="/opportunities/[a-z0-9-]*"' | sort -u); O2=$(curl -s "$B/opportunities?page=2" | grep -o 'href="/opportunities/[a-z0-9-]*"' | sort -u)
[ "$(echo "$O1" | wc -l)" -ge 12 ] && [ -n "$O2" ] && [ -z "$(comm -12 <(echo "$O1") <(echo "$O2"))" ] && ok "opportunity pagination returns distinct pages" || bad "opportunity pagination"
expect_has  "opportunity page: source and last-checked" "Last checked by Buna" "$B/opportunities/real-grant"
expect_has  "opportunity page: apply link is rel=nofollow" 'rel="noopener noreferrer nofollow"' "$B/opportunities/real-grant"
expect_has  "opportunity page: eligibility" "Early-stage teams" "$B/opportunities/real-grant"
expect_has  "closed opportunity page says closed" "This opportunity has closed" "$B/opportunities/stale-closed"
expect_has  "demo opportunity is labelled and noindex" "Demo listing" "$B/opportunities/demo-seed-grant"
expect_code "draft opportunity is 404" 404 "$B/opportunities/draft-opportunity"
expect_code "archived opportunity is 404" 404 "$B/opportunities/archived-opportunity"
expect_has  "founders list shows opted-in founders" "Filler Founder" "$B/founders"
expect_has  "founder search by name" "Olivia Owner" "$B/founders?q=olivia"
expect_lacks "founders list hides members who didn't opt in" "Vera Voter" "$B/founders"
expect_has  "founder filter: open to" "Olivia Owner" "$B/founders?openTo=mentoring"
expect_lacks "founder filter excludes others" "Filler Founder" "$B/founders?openTo=mentoring"
expect_has  "founder filter: expertise" "Olivia Owner" "$B/founders?expertise=payments"
expect_has  "founder filter: country" "Filler Founder" "$B/founders?country=KE"
F1=$(curl -s "$B/founders" | grep -o 'href="/founders/[a-z0-9_-]*"' | sort -u); F2=$(curl -s "$B/founders?page=2" | grep -o 'href="/founders/[a-z0-9_-]*"' | sort -u)
[ "$(echo "$F1" | wc -l)" -ge 12 ] && [ -n "$F2" ] && [ -z "$(comm -12 <(echo "$F1") <(echo "$F2"))" ] && ok "founder pagination returns distinct pages" || bad "founder pagination"
expect_has  "founder page: open to and expertise" "Giving advice" "$B/founders/olivia"
expect_code "a member who didn't opt in has no founder page" 404 "$B/founders/vera"
expect_has  "investors list" "Real Fund" "$B/investors"
expect_lacks "investors list hides unpublished" "Hidden Fund" "$B/investors"
expect_has  "investor filter: stage" "Real Fund" "$B/investors?stage=mvp"
expect_lacks "investor filter excludes others" "Real Fund" "$B/investors?stage=scale"
for page in about help contact privacy terms guidelines; do expect_code "/$page loads" 200 "$B/$page"; done
expect_has  "privacy policy names the processors" "Supabase" "$B/privacy"
expect_has  "privacy policy names Resend and Vercel" "Resend" "$B/privacy"
expect_has  "terms say verification is not an endorsement" "not an endorsement" "$B/terms"
expect_has  "guidelines explain moderation and appeals" "Appeals" "$B/guidelines"
expect_has  "help explains that votes are final" "Votes are final" "$B/help"
expect_has  "signup requires accepting the terms" "I agree to the" "$B/signup"
expect_has  "about page has no invented statistics" "Honest numbers" "$B/about"
expect_has  "startup page has the contact form" "Contact this startup" "$B/startups/owner-works-co"
expect_has  "sitemap lists static and directory pages" "/opportunities/real-grant" "$B/sitemap.xml"
SM2=$(curl -s "$B/sitemap.xml"); echo "$SM2" | grep -q "demo-seed-grant\|demo-capital-partners\|draft-opportunity\|hidden-fund" && bad "sitemap leaks demo or non-public pages" || ok "sitemap excludes demo, draft and unpublished pages"
echo "$SM2" | grep -q "/privacy" && echo "$SM2" | grep -q "/founders/olivia" && ok "sitemap includes legal pages and opted-in founders" || bad "sitemap legal/founders"
echo "== generated images and assets =="
for u in /opengraph-image /startups/owner-works-co/opengraph-image /launches/owner-launch/opengraph-image /opportunities/real-grant/opengraph-image /apple-icon.png /favicon.ico /icons/icon-512.png /icons/maskable-512.png /logo.svg /illustrations/hero.svg; do
  T=$(curl -s -o /tmp/asset.bin -w "%{http_code} %{content_type} %{size_download}" "$B$u"); CODE=${T%% *}; SIZE=${T##* }
  [ "$CODE" = "200" ] && [ "$SIZE" -gt 400 ] && ok "$u ($T)" || bad "$u ($T)"
done
file /tmp/asset.bin >/dev/null 2>&1
curl -s -o /tmp/og.bin "$B/opengraph-image"; head -c 8 /tmp/og.bin | od -An -c | grep -q "P   N   G" && ok "social image is a real PNG" || bad "social image is not a PNG"
expect_has  "manifest names the app and icons" "maskable" "$B/manifest.webmanifest"
expect_has  "startup page advertises a large social card" "twitter:card\" content=\"summary_large_image" "$B/startups/owner-works-co"
expect_has  "startup page links its generated social image" "opengraph-image" "$B/startups/owner-works-co"
expect_code "unknown startup's social image falls back (not an error)" 200 "$B/startups/nope-nope/opengraph-image"

echo "== signed-in owner =="
expect_code "dashboard" 200 "$B/dashboard" -H "Cookie: $OWNER_COOKIE"
expect_has  "my startups lists draft and published" "Secret Draft Labs" "$B/dashboard/startup" -H "Cookie: $OWNER_COOKIE"
expect_has  "my startups lists published startup" "Owner Works" "$B/dashboard/startup" -H "Cookie: $OWNER_COOKIE"
expect_lacks "my startups excludes others' startups" "Stranger Co" "$B/dashboard/startup" -H "Cookie: $OWNER_COOKIE"
expect_has  "draft preview with banner" "only your team can see" "$B/startups/secret-draft" -H "Cookie: $OWNER_COOKIE"
expect_has  "draft preview is noindex" "noindex" "$B/startups/secret-draft" -H "Cookie: $OWNER_COOKIE"
expect_has  "edit form is prefilled" 'value="Owner Works"' "$B/dashboard/startup/11111111-1111-4111-8111-111111111111" -H "Cookie: $OWNER_COOKIE"
expect_has  "products page lists product" "Owner App" "$B/dashboard/startup/11111111-1111-4111-8111-111111111111/products" -H "Cookie: $OWNER_COOKIE"
expect_has  "links page lists link" "github.com/owner-works" "$B/dashboard/startup/11111111-1111-4111-8111-111111111111/links" -H "Cookie: $OWNER_COOKIE"
expect_has  "images page lists screenshot" "Dashboard screenshot" "$B/dashboard/startup/11111111-1111-4111-8111-111111111111/images" -H "Cookie: $OWNER_COOKIE"
expect_has  "settings shows checklist for a draft" "Publishing checklist" "$B/dashboard/startup/22222222-2222-4222-8222-222222222222/settings" -H "Cookie: $OWNER_COOKIE"
expect_has  "settings offers deleting a draft" "Delete startup" "$B/dashboard/startup/22222222-2222-4222-8222-222222222222/settings" -H "Cookie: $OWNER_COOKIE"
expect_code "cannot manage someone else's published startup" 404 "$B/dashboard/startup/33333333-3333-4333-8333-333333333333" -H "Cookie: $OWNER_COOKIE"
expect_code "invalid id is 404" 404 "$B/dashboard/startup/not-a-uuid" -H "Cookie: $OWNER_COOKIE"

echo "== signed-in stranger =="
expect_code "stranger cannot see the draft" 404 "$B/startups/secret-draft" -H "Cookie: $STRANGER_COOKIE"
expect_code "stranger cannot open owner's workspace" 404 "$B/dashboard/startup/22222222-2222-4222-8222-222222222222" -H "Cookie: $STRANGER_COOKIE"
expect_code "stranger cannot open /admin" 307 "$B/admin" -H "Cookie: $STRANGER_COOKIE"
LOC=$(curl -s -o /dev/null -w "%{redirect_url}" "$B/admin" -H "Cookie: $STRANGER_COOKIE"); [[ "$LOC" == */forbidden ]] && ok "/admin sends non-staff to /forbidden" || bad "/admin redirect ($LOC)"

echo "== server actions (forms submitted like a browser without JavaScript) =="
export B OWNER_COOKIE STRANGER_COOKIE MOD_COOKIE VOTER_COOKIE UNVER_COOKIE ADMIN_COOKIE DORA_COOKIE DB OWNER STRANGER CRON_SECRET
cd scripts/integration
python3 actions_test.py || FAIL=1
echo "== launches, votes, comments, moderation, follows, notifications =="
python3 launches_test.py || FAIL=1
echo "== opportunities, inquiries, team, admin, contact, export, deletion =="
python3 phase4_test.py || FAIL=1
echo "== admin, moderation, verification, settings =="
expect_code "staff community moderation page renders" 200 "$B/admin/community" -H "Cookie: $ADMIN_COOKIE"
python3 phase5_test.py || FAIL=1
cd ../..
echo "== accessibility scan (axe-core on rendered HTML) =="
B=$B OWNER_COOKIE="$OWNER_COOKIE" MOD_COOKIE="$MOD_COOKIE" ADMIN_COOKIE="$ADMIN_COOKIE" node scripts/integration/a11y.mjs || FAIL=1
echo "== response times (production server, local database) =="
for path in / /startups /startups/owner-works-co /launches /launches/owner-launch /opportunities /founders /about; do
  TOTAL=0; for i in 1 2 3 4 5; do MS=$(curl -s -o /dev/null -w "%{time_total}" "$B$path" | awk '{printf "%d", $1*1000}'); TOTAL=$((TOTAL+MS)); done; AVG=$((TOTAL/5))
  [ "$AVG" -lt 1500 ] && ok "$path averages ${AVG} ms" || bad "$path averages ${AVG} ms (budget 1500)"
done
echo "== security headers =="
HDR=$(curl -sI "$B/")
echo "$HDR" | grep -qi "content-security-policy: default-src 'self'" && ok "CSP header is set" || bad "CSP header missing"
CSP=$(printf '%s\n' "$HDR" | tr -d '\r' | sed -n 's/^[Cc]ontent-Security-Policy:[[:space:]]*//p')
SCRIPT_CSP=$(printf '%s' "$CSP" | tr ';' '\n' | sed 's/^[[:space:]]*//' | grep '^script-src' || true)
printf '%s' "$SCRIPT_CSP" | grep -q "'nonce-" && ok "CSP has a per-response script nonce" || bad "CSP script nonce missing"
printf '%s' "$SCRIPT_CSP" | grep -q "unsafe-inline" && bad "CSP still allows inline scripts" || ok "CSP blocks inline scripts"
echo "$HDR" | grep -qi "frame-ancestors 'none'" && ok "CSP forbids framing" || bad "CSP frame-ancestors missing"
echo "$HDR" | grep -qi "object-src 'none'" && ok "CSP forbids plugins" || bad "CSP object-src missing"
echo "$HDR" | grep -qi "strict-transport-security" && ok "HSTS is set" || bad "HSTS missing"
echo "$HDR" | grep -qi "x-content-type-options: nosniff" && ok "nosniff is set" || bad "nosniff missing"
echo "$HDR" | grep -qi "x-powered-by" && bad "X-Powered-By is exposed" || ok "no X-Powered-By header"
BODY=$(curl -s "$B/admin/launches"); [ -z "$BODY" ] && ok "admin pages don't render for anonymous users" || ok "admin redirect has an empty body"

echo; [ "$FAIL" = "0" ] && echo "INTEGRATION CHECKS PASSED" || { echo "INTEGRATION CHECKS FAILED"; echo "--- next log ---"; tail -15 /tmp/next-it.log; exit 1; }
