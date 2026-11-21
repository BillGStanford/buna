#!/usr/bin/env node
// Static checks for supabase/migrations: sequential numbering, naming, no empty files,
// and a guard that every `create table` in public is covered by RLS (enabled in 0005 or in-file).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const errors = [];

files.forEach((file, i) => {
  const expected = String(i + 1).padStart(4, "0");
  if (!file.startsWith(expected + "_")) errors.push(`${file}: expected prefix ${expected}_ (numbers must be sequential with no gaps)`);
  if (!/^\d{4}_[a-z0-9_]+\.sql$/.test(file)) errors.push(`${file}: use NNNN_snake_case.sql`);
  const sql = readFileSync(join(dir, file), "utf8");
  if (sql.trim().length === 0) errors.push(`${file}: empty`);
  // The one reviewed exception is the forward-only removal of Buna Work after the
  // product decision to replace it with Co-Founder Discovery. All other drops remain blocked.
  const reviewedTableRemoval = file === "0029_remove_work_add_cofounder_discovery.sql";
  if (/\bdrop\s+table\b/i.test(sql) && !reviewedTableRemoval) errors.push(`${file}: contains DROP TABLE — write a reviewed, explicit migration instead`);
  // New migrations that touch permissions, member data, notifications or critical
  // workflows must declare a checked-in SQL regression test.
  if (Number(file.slice(0, 4)) >= 42 && /\b(grant|revoke|create\s+policy|drop\s+policy|enable\s+row\s+level\s+security|notification|referral|payment|billing|payout|signup|auth\.users|public\.profiles)\b/i.test(sql)) {
    const test = sql.match(/^\s*--\s*regression-test:\s*(supabase\/tests\/[a-z0-9_./-]+\.sql)\s*$/im)?.[1];
    if (!test) errors.push(`${file}: security/data/workflow migration must declare -- regression-test: supabase/tests/<name>.sql`);
    else if (!existsSync(join(process.cwd(), test))) errors.push(`${file}: declared regression test does not exist: ${test}`);
  }
});

const all = files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
const tables = [...all.matchAll(/create table public\.(\w+)/gi)].map((m) => m[1]);
const rlsLoop = /for t in select tablename from pg_tables where schemaname = 'public'[\s\S]*?enable row level security/i.test(all);
if (!rlsLoop) errors.push("0005 must enable RLS on every public table (loop over pg_tables not found)");

if (errors.length) {
  console.error("Migration check failed:\n - " + errors.join("\n - "));
  process.exit(1);
}
console.log(`Migration check passed: ${files.length} files, ${tables.length} public tables, RLS enabled globally.`);
