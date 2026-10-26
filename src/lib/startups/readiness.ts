export type ReadinessInput = {
  name?: string | null;
  tagline?: string | null;
  description?: string | null;
  category_id?: string | null;
  country?: string | null;
};

export type ReadinessItem = { key: string; label: string; href?: string };

/**
 * What a startup needs before it can be published. Mirrors the checks inside the database function
 * `set_startup_publication` (which is the real enforcement); this powers the checklist in the UI.
 */
export function publishReadiness(s: ReadinessInput): { ready: boolean; missing: ReadinessItem[] } {
  const blank = (v: string | null | undefined) => !v || v.trim() === "";
  const missing: ReadinessItem[] = [];
  if (blank(s.tagline)) missing.push({ key: "tagline", label: "Add a one-line description" });
  if (blank(s.description)) missing.push({ key: "description", label: "Write about your startup" });
  if (!s.category_id) missing.push({ key: "category", label: "Choose a sector" });
  if (blank(s.country)) missing.push({ key: "country", label: "Choose a country" });
  return { ready: missing.length === 0, missing };
}
