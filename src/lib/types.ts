import type { PlatformRole } from "@/lib/permissions";

/** Row shape of public.profiles (regenerate full types with `npm run db:types` once the CLI is linked). */
export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  professional_role: string | null;
  founder_status: string | null;
  interests: string[];
  expertise: string[];
  open_to: string[];
  startup_intent: string | null;
  website_url: string | null;
  role: PlatformRole;
  is_suspended: boolean;
  suspended_reason: string | null;
  is_public_profile: boolean;
  show_location: boolean;
  is_discoverable_founder: boolean;
  onboarding_completed_at: string | null;
  onboarding_skipped_at: string | null;
  created_at: string;
};

export type Category = { id: string; slug: string; name: string };

/** Result shape returned by every server action that backs a form. */
export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Echoed back (never passwords) so the form keeps what the user typed. */
  values?: Record<string, string | string[]>;
  /** Extra hint for the UI, e.g. offer to resend a verification email. */
  hint?: "needs_verification";
};

export const idleState: ActionState = { status: "idle" };
