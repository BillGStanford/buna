import { renderOg, OG_SIZE, OG_TYPE } from "@/lib/og";
import { categoryLabel } from "@/lib/opportunities/constants";
import { deadlineState, describeDeadline } from "@/lib/opportunities/params";
import { createPublicClient } from "@/lib/supabase/public";

export const alt = "Opportunity on Buna";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createPublicClient();
  const { data } = supabase ? await supabase.from("opportunities").select("title, organization, category, deadline, status").eq("slug", slug.toLowerCase()).in("status", ["published", "expired"]).maybeSingle() : { data: null };
  if (!data) return renderOg({ eyebrow: "Opportunity", title: "Opportunities for African founders" });
  return renderOg({ eyebrow: "Opportunity", title: data.title, subtitle: data.organization, chips: [categoryLabel(data.category), describeDeadline(deadlineState(data.status, data.deadline))] });
}
