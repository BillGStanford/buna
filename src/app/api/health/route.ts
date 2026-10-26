import { NextResponse } from "next/server";
import { isEmailConfigured, isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Smoke-test endpoint for deployments. Reports configuration/connectivity only — never secrets. */
export async function GET() {
  const checks = {
    supabase_configured: isSupabaseConfigured(),
    service_role_configured: isServiceRoleConfigured(),
    email_configured: isEmailConfigured(),
    database: "skipped" as "ok" | "error" | "skipped",
  };
  if (checks.service_role_configured) {
    try {
      const { error } = await createAdminClient().from("categories").select("id", { head: true, count: "exact" });
      checks.database = error ? "error" : "ok";
    } catch {
      checks.database = "error";
    }
  }
  const healthy = checks.database !== "error";
  return NextResponse.json({ status: healthy ? "ok" : "degraded", checks }, { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
