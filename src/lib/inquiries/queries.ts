import "server-only";
import { createClient } from "@/lib/supabase/server";

export const INQUIRY_PAGE_SIZE = 20;
export type InquiryRow = {
  id: string; startup_id: string; sender_name: string; sender_email: string; category: string; subject: string; message: string;
  status: string; read_at: string | null; email_status: string; created_at: string; startup: { name: string; slug: string } | null;
};
const COLUMNS = "id, startup_id, sender_name, sender_email, category, subject, message, status, read_at, email_status, created_at, startup:startups(name, slug)";
const norm = (r: unknown): InquiryRow => {
  const row = r as InquiryRow & { startup: unknown };
  return { ...row, startup: (Array.isArray(row.startup) ? row.startup[0] : row.startup) as InquiryRow["startup"] ?? null };
};

export async function listInquiries(status: string, page: number): Promise<{ items: InquiryRow[]; total: number }> {
  const supabase = await createClient();
  let q = supabase.from("inquiries").select(COLUMNS, { count: "exact" }).order("created_at", { ascending: false }).order("id");
  if (status) q = q.eq("status", status);
  const from = (page - 1) * INQUIRY_PAGE_SIZE;
  const { data, count, error } = await q.range(from, from + INQUIRY_PAGE_SIZE - 1);
  if (error && error.code === "PGRST103") return { items: [], total: 0 };
  if (error) throw error;
  return { items: (data ?? []).map(norm), total: count ?? 0 };
}

export async function getInquiry(id: string): Promise<InquiryRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("inquiries").select(COLUMNS).eq("id", id).maybeSingle();
  return data ? norm(data) : null;
}

export async function unreadInquiryCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const { count } = await supabase.from("inquiries").select("id", { count: "exact", head: true }).is("read_at", null);
    return count ?? 0;
  } catch { return 0; }
}
