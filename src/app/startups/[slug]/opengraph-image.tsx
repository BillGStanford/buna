import { renderOg, OG_SIZE, OG_TYPE } from "@/lib/og";
import { countryName } from "@/lib/geo";
import { stageLabel } from "@/lib/startups/constants";
import { createPublicClient } from "@/lib/supabase/public";

export const alt = "Startup on Buna";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createPublicClient();
  const { data } = supabase
    ? await supabase.from("startups").select("name, tagline, country, city, stage, category:categories(name)").eq("slug", slug.toLowerCase()).eq("status", "published").maybeSingle()
    : { data: null };
  if (!data) return renderOg({ eyebrow: "Startup", title: "Discover African startups" });
  const category = (Array.isArray(data.category) ? data.category[0] : data.category) as { name: string } | null;
  const place = [data.city, countryName(data.country)].filter(Boolean).join(", ");
  return renderOg({ eyebrow: "Startup", title: data.name, subtitle: data.tagline, chips: [category?.name, stageLabel(data.stage), place] });
}
