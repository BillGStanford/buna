import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { sha256Hex } from "@/lib/crypto";

const log = createLogger("rate-limit");

export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || h.get("x-real-ip") || "unknown";
}

/**
 * Fixed-window rate limit backed by Postgres (public.check_rate_limit, service role only).
 * Returns true when the request is allowed.
 * - Not configured: allowed in development, refused in production (never silently unprotected).
 * - Database error: logged and refused. A broken limiter must never silently disable protection.
 *   Supabase Auth applies its own limits on top for sign-in/up/reset.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!isServiceRoleConfigured()) return process.env.NODE_ENV !== "production";
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("check_rate_limit", {
      // keys embed IP addresses and email addresses; only a hash reaches the database
      p_key: sha256Hex(key).slice(0, 40),
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      log.error("rate limit rpc failed", error);
      return false;
    }
    return data === true;
  } catch (err) {
    log.error("rate limit check threw", err);
    return false;
  }
}
