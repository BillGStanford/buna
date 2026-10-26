import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EnvError, getPublicEnv, getServerEnv, getSiteUrl, isEmailConfigured, isSupabaseConfigured } from "./env";

const KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SITE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "EMAIL_FROM"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => { KEYS.forEach((k) => { saved[k] = process.env[k]; delete process.env[k]; }); });
afterEach(() => { KEYS.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }); });

describe("env validation", () => {
  it("reports missing public vars by name only", () => {
    expect(isSupabaseConfigured()).toBe(false);
    expect(() => getPublicEnv()).toThrow(EnvError);
    try { getPublicEnv(); } catch (e) {
      expect((e as EnvError).missing).toEqual(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
    }
  });
  it("accepts a complete public config and defaults the site url", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "x".repeat(40);
    expect(isSupabaseConfigured()).toBe(true);
    expect(getPublicEnv().NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });
  it("treats blank optional vars as unset", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "y".repeat(40);
    process.env.RESEND_API_KEY = "";
    expect(getServerEnv().RESEND_API_KEY).toBeUndefined();
    expect(isEmailConfigured()).toBe(false);
    process.env.RESEND_API_KEY = "re_" + "z".repeat(20);
    process.env.EMAIL_FROM = "Buna <hello@example.com>";
    expect(isEmailConfigured()).toBe(true);
  });
  it("strips trailing slashes from the site url", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://buna.example/";
    expect(getSiteUrl()).toBe("https://buna.example");
  });
});
