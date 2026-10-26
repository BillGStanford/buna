/** Slug helpers shared by startups, launches, opportunities and investors. */

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Routes and words that must never be claimed as a public slug.
export const RESERVED_SLUGS = new Set([
  "new", "submit", "edit", "admin", "api", "login", "signup", "dashboard", "settings",
  "search", "null", "undefined", "buna", "about", "help", "contact", "privacy", "terms",
]);

export function slugify(input: string, maxLength = 60): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug;
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 60 && SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug);
}

/** Builds a candidate slug; falls back to `fallback` when the name has no latin characters (e.g. Amharic). */
export function slugCandidate(name: string, attempt = 0, fallback = "startup"): string {
  let base = slugify(name, 52);
  if (base.length < 3 || RESERVED_SLUGS.has(base)) base = `${base ? base + "-" : ""}${fallback}`;
  if (attempt === 0) return base.slice(0, 60);
  return `${base.slice(0, 52)}-${attempt + 1}`;
}
