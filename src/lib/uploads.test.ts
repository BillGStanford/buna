import { describe, expect, it } from "vitest";
import { checkImageFile, sniffImageType, storagePathFromPublicUrl } from "./uploads";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0]);

describe("sniffImageType", () => {
  it("detects real formats from magic bytes", () => {
    expect(sniffImageType(jpeg)).toBe("jpeg");
    expect(sniffImageType(png)).toBe("png");
    expect(sniffImageType(webp)).toBe("webp");
  });
  it("rejects everything else", () => {
    expect(sniffImageType(exe)).toBeNull();
    expect(sniffImageType(new Uint8Array([]))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
});

describe("checkImageFile", () => {
  it("accepts a valid image regardless of the claimed MIME type", async () => {
    const r = await checkImageFile(new File([png], "x.exe", { type: "application/x-msdownload" }), 1024);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.contentType).toBe("image/png");
  });
  it("rejects a disguised executable", async () => {
    const r = await checkImageFile(new File([exe], "photo.jpg", { type: "image/jpeg" }), 1024);
    expect(r.ok).toBe(false);
  });
  it("rejects oversized and missing files", async () => {
    expect((await checkImageFile(new File([png], "a.png"), 4)).ok).toBe(false);
    expect((await checkImageFile(null, 1024)).ok).toBe(false);
    expect((await checkImageFile(new File([], "a.png"), 1024)).ok).toBe(false);
  });
});

describe("storagePathFromPublicUrl", () => {
  it("extracts the object path for a bucket", () => {
    expect(storagePathFromPublicUrl("https://x.supabase.co/storage/v1/object/public/avatars/u1/a%20b.png?t=1", "avatars")).toBe("u1/a b.png");
  });
  it("returns null for other buckets, junk and empty input", () => {
    expect(storagePathFromPublicUrl("https://x.co/y.png", "avatars")).toBeNull();
    expect(storagePathFromPublicUrl(null, "avatars")).toBeNull();
    expect(storagePathFromPublicUrl("https://x/avatars/%E0%A4%A", "avatars")).toBeNull();
  });
});
