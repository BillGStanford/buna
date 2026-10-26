/** Image upload validation shared by avatars (now) and startup logos / screenshots (phase 2). */

export type ImageKind = "jpeg" | "png" | "webp";

export const IMAGE_MIME: Record<ImageKind, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
const EXT: Record<ImageKind, string> = { jpeg: "jpg", png: "png", webp: "webp" };

/** Detects the real image type from magic bytes — the client-declared MIME type is not trusted. */
export function sniffImageType(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "webp";
  return null;
}

export type ImageCheck =
  | { ok: true; kind: ImageKind; contentType: string; extension: string; bytes: Uint8Array }
  | { ok: false; error: string };

export async function checkImageFile(file: File | null | undefined, maxBytes: number): Promise<ImageCheck> {
  if (!file || typeof file === "string" || file.size === 0) return { ok: false, error: "Choose an image to upload." };
  if (file.size > maxBytes) {
    return { ok: false, error: `That image is too large. The limit is ${Math.round(maxBytes / 1024 / 1024)} MB.` };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImageType(bytes);
  if (!kind) return { ok: false, error: "Use a JPEG, PNG or WebP image." };
  return { ok: true, kind, contentType: IMAGE_MIME[kind], extension: EXT[kind], bytes };
}

/** Extracts the object path from a Supabase public URL (…/storage/v1/object/public/<bucket>/<path>). */
export function storagePathFromPublicUrl(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null;
  const marker = `/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  try {
    return decodeURIComponent(url.slice(i + marker.length).split("?")[0] ?? "") || null;
  } catch {
    return null;
  }
}
