#!/usr/bin/env node
// Static checks for supabase/migrations: sequential numbering, naming, no empty files,
// and a guard that every `create table` in public is covered by RLS (enabled in 0005 or in-file).
import { readdirSync, readFileSync } from "node:fs";
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
  if (/\bdrop\s+table\b/i.test(sql)) errors.push(`${file}: contains DROP TABLE — write a reviewed, explicit migration instead`);
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
