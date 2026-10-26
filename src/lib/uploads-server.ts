import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImageCheck } from "@/lib/uploads";

/** Uploads a validated image to a public bucket under {folder}/{prefix}-{uuid}.{ext}. */
export async function uploadPublicImage(
  supabase: SupabaseClient, bucket: string, folder: string, prefix: string, check: Extract<ImageCheck, { ok: true }>,
): Promise<{ ok: true; path: string; url: string } | { ok: false; error: unknown }> {
  const path = `${folder}/${prefix}-${crypto.randomUUID()}.${check.extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, check.bytes, { contentType: check.contentType, upsert: false, cacheControl: "31536000" });
  if (error) return { ok: false, error };
  return { ok: true, path, url: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl };
}
