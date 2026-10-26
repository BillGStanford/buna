"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { checkImageFile, storagePathFromPublicUrl } from "@/lib/uploads";
import { createLogger } from "@/lib/logger";
import { flattenErrors, formDataToObject } from "@/lib/validation/common";
import { profileSchema } from "@/lib/validation/profile";
import type { ActionState } from "@/lib/types";

const log = createLogger("profile");
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  const raw = formDataToObject(formData, ["interests", "openTo"]);
  const input = {
    ...raw,
    isPublicProfile: formData.get("isPublicProfile") === "on",
    showLocation: formData.get("showLocation") === "on",
    isDiscoverableFounder: formData.get("isDiscoverableFounder") === "on",
  };
  const echo = (k: string) => String(raw[k] ?? "");
  const values = {
    displayName: echo("displayName"), username: echo("username"), headline: echo("headline"), bio: echo("bio"),
    country: echo("country"), city: echo("city"), professionalRole: echo("professionalRole"), founderStatus: echo("founderStatus"),
    websiteUrl: echo("websiteUrl"), expertise: echo("expertise"), interests: (raw.interests as string[]) ?? [],
  };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { status: "error", fieldErrors: flattenErrors(parsed.error), values, message: "Fix the highlighted fields and save again." };

  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: d.displayName, username: d.username, headline: d.headline, bio: d.bio, country: d.country, city: d.city,
      professional_role: d.professionalRole, founder_status: d.founderStatus, website_url: d.websiteUrl,
      interests: d.interests, expertise: d.expertise, open_to: d.openTo, is_public_profile: d.isPublicProfile,
      show_location: d.showLocation, is_discoverable_founder: d.isDiscoverableFounder,
    })
    .eq("id", profile.id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") return { status: "error", fieldErrors: { username: ["That username is taken. Try another."] }, values };
    if (error.code === "42501") return { status: "error", message: "Your account can’t make changes right now.", values };
    log.error("profile update failed", error, { code: error.code });
    return { status: "error", message: "We couldn’t save your profile. Please try again.", values };
  }
  if (!data) return { status: "error", message: "We couldn’t save your profile. Please try again.", values };

  revalidatePath("/", "layout");
  return { status: "success", message: "Profile saved." };
}

export async function uploadAvatarAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireActiveProfile();
  if (!(await rateLimit(`upload:${profile.id}`, 20, 3600))) {
    return { status: "error", message: "You’ve uploaded a lot of images recently. Please try again later." };
  }
  const file = formData.get("avatar");
  const check = await checkImageFile(file instanceof File ? file : null, AVATAR_MAX_BYTES);
  if (!check.ok) return { status: "error", message: check.error };

  const supabase = await createClient();
  const path = `${profile.id}/${crypto.randomUUID()}.${check.extension}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, check.bytes, { contentType: check.contentType, upsert: false, cacheControl: "31536000" });
  if (uploadError) {
    log.error("avatar upload failed", uploadError);
    return { status: "error", message: "The upload failed. Check your connection and try again." };
  }

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  const { error: updateError } = await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", profile.id);
  if (updateError) {
    await supabase.storage.from("avatars").remove([path]);
    log.error("avatar url update failed", updateError);
    return { status: "error", message: "We couldn’t save your new photo. Please try again." };
  }

  const old = storagePathFromPublicUrl(profile.avatar_url, "avatars");
  if (old && old !== path) await supabase.storage.from("avatars").remove([old]);

  revalidatePath("/", "layout");
  return { status: "success", message: "Photo updated." };
}

export async function removeAvatarAction(): Promise<void> {
  const profile = await requireActiveProfile();
  const supabase = await createClient();
  const old = storagePathFromPublicUrl(profile.avatar_url, "avatars");
  await supabase.from("profiles").update({ avatar_url: null }).eq("id", profile.id);
  if (old) await supabase.storage.from("avatars").remove([old]);
  revalidatePath("/", "layout");
}
