import { renderOg, OG_SIZE, OG_TYPE } from "@/lib/og";
import { createPublicClient } from "@/lib/supabase/public";

export const alt = "Launch on Buna";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createPublicClient();
  const { data } = supabase
    ? await supabase.from("launches").select("name, tagline, vote_count, category:categories(name)").eq("slug", slug.toLowerCase()).in("status", ["published", "scheduled"]).maybeSingle()
    : { data: null };
  if (!data) return renderOg({ eyebrow: "Launch", title: "New launches from Africa" });
  const category = (Array.isArray(data.category) ? data.category[0] : data.category) as { name: string } | null;
  return renderOg({ eyebrow: "Launch", title: data.name, subtitle: data.tagline, chips: [category?.name, data.vote_count > 0 ? `${data.vote_count} votes` : null] });
}
