import { z } from "zod";

/**
 * Environment validation. Validation is lazy (called where a value is needed) so that
 * `next build` and the public marketing pages work before Supabase is configured; every
 * feature that needs a service fails gracefully with a clear message instead of crashing.
 * Error messages list variable NAMES only, never values.
 */

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.preprocess(blankToUndefined, z.string().url().default("http://localhost:3000")),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  RESEND_API_KEY: z.preprocess(blankToUndefined, z.string().min(10).optional()),
  EMAIL_FROM: z.preprocess(blankToUndefined, z.string().min(3).optional()),
  CRON_SECRET: z.preprocess(blankToUndefined, z.string().min(16).optional()),
  CHAPA_PRIVATE_KEY: z.preprocess(blankToUndefined, z.string().min(10).optional()),
  CHAPA_WEBHOOK_SECRET: z.preprocess(blankToUndefined, z.string().min(16).optional()),
  BUNA_WORK_PLATFORM_FEE_PERCENT: z.preprocess(blankToUndefined, z.string().regex(/^(?:[0-9]|[1-9][0-9])(?:\\.[0-9]{1,2})?$/).optional()),
});

export class EnvError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing or invalid environment variables: ${missing.join(", ")}`);
    this.name = "EnvError";
  }
}

// NEXT_PUBLIC_* must be referenced literally so Next.js can inline them into the browser bundle.
function readPublic() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  };
}

export function getPublicEnv() {
  const parsed = publicSchema.safeParse(readPublic());
  if (!parsed.success) {
    throw new EnvError(parsed.error.issues.map((i) => String(i.path[0])));
  }
  return parsed.data;
}

export function getServerEnv() {
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    CRON_SECRET: process.env.CRON_SECRET,
    CHAPA_PRIVATE_KEY: process.env.CHAPA_PRIVATE_KEY,
    CHAPA_WEBHOOK_SECRET: process.env.CHAPA_WEBHOOK_SECRET,
    BUNA_WORK_PLATFORM_FEE_PERCENT: process.env.BUNA_WORK_PLATFORM_FEE_PERCENT,
  });
  if (!parsed.success) {
    throw new EnvError(parsed.error.issues.map((i) => String(i.path[0])));
  }
  return parsed.data;
}

export function isSupabaseConfigured(): boolean {
  return publicSchema.safeParse(readPublic()).success;
}

export function isServiceRoleConfigured(): boolean {
  return isSupabaseConfigured() && serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }).success;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
