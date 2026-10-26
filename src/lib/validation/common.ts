import { z } from "zod";
import { isKnownCountry } from "@/lib/geo";

/** http(s) only — rejects javascript:, data:, file: and other unsafe schemes. */
export const httpUrl = z
  .string()
  .trim()
  .max(300, "That link is too long.")
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Enter a full link starting with https://");

export const optionalHttpUrl = z.union([httpUrl, z.literal("")]).transform((v) => (v === "" ? null : v));

export const optionalText = (max: number) =>
  z.string().trim().max(max, `Use ${max} characters or fewer.`).transform((v) => (v === "" ? null : v));

export const emailField = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);

export const passwordField = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(72, "Use 72 characters or fewer.");

export const countryField = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => v === "" || isKnownCountry(v), "Choose a country from the list.")
  .transform((v) => (v === "" ? null : v));

/** Reads a FormData into plain values; repeated keys (checkboxes) become arrays. */
export function formDataToObject(formData: FormData, arrayKeys: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$ACTION")) continue; // Next.js internals
    const all = formData.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = arrayKeys.includes(key) ? all : (all[0] ?? "");
  }
  for (const key of arrayKeys) if (!(key in out)) out[key] = [];
  return out;
}

export function flattenErrors(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}
