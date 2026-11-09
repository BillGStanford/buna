import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ExternalLinkText } from "@/components/people/cards";
import { ReportDialog } from "@/components/startups/report-dialog";
import { getUser } from "@/lib/auth/session";
import { countryName } from "@/lib/geo";
import { getInvestor } from "@/lib/people/queries";
import { stageLabel } from "@/lib/startups/constants";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ slug: string }> };
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const safe = (url: string | null) => { if (!url) return null; try { const u = new URL(url); return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null; } catch { return null; } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const i = SLUG_RE.test(slug.toLowerCase()) ? await getInvestor(slug.toLowerCase()) : null;
  if (!i) return { title: "Investor not found", robots: { index: false } };
  return { title: i.name, description: (i.description || `${i.name} on Buna`).slice(0, 160), alternates: { canonical: `/investors/${i.slug}` }, robots: i.is_published && !i.is_demo ? undefined : { index: false, follow: false } };
}

export default async function InvestorPage({ params }: Props) {
  const { slug } = await params;
  if (!SLUG_RE.test(slug.toLowerCase())) notFound();
  const i = await getInvestor(slug.toLowerCase());
  if (!i) notFound();
  const user = await getUser();
  const site = safe(i.website_url);
  const contact = safe(i.contact_url);
  const publicWhatsApp = i.public_contact_whatsapp
    ? (i.public_contact_whatsapp.startsWith("http") ? safe(i.public_contact_whatsapp) : "https://wa.me/" + i.public_contact_whatsapp.replace(/\D/g, ""))
    : null;
  const publicTelegram = i.public_contact_telegram
    ? (i.public_contact_telegram.startsWith("http") ? safe(i.public_contact_telegram) : "https://t.me/" + i.public_contact_telegram.replace(/^@/, ""))
    : null;
  const publicFacebook = safe(i.public_contact_facebook);
  const publicOther = safe(i.public_contact_other_url);
  const loginHref = `/login?next=${encodeURIComponent(`/investors/${i.slug}`)}`;
  const supabase = await createClient();
  const { data: acceptsIntroductions } = await supabase.rpc("investor_accepts_introductions", { p_investor: i.id });
  const { data: claimable } = await supabase.rpc("investor_listing_claimable", { p_investor: i.id });
  return (
    <div className="container-page space-y-6 py-8">
      <p className="text-sm"><Link href="/investors" className="font-medium">All investors</Link></p>
      {!i.is_published ? <Alert tone="warning" title="Unpublished — visible to staff only" /> : null}
      {i.is_demo ? <Alert tone="info" title="Demo listing">This is a fictional organisation used to preview Buna.</Alert> : null}
      <header className="max-w-3xl space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold">{i.name}</h1>
          {i.verification_status === "verified" ? <Badge tone="green"><BadgeCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />Verified by Buna</Badge> : <Badge>Not verified</Badge>}
        </div>
        {i.description ? <p className="text-lg text-muted">{i.description}</p> : null}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {contact ? <a href={contact} target="_blank" rel="noopener noreferrer nofollow" className={buttonStyles("primary", "md")}>Apply or contact<span className="sr-only"> (opens the organisation’s own page in a new tab)</span></a> : null}
          {site ? <ExternalLinkText href={site}>{new URL(site).host.replace(/^www\./, "")}</ExternalLinkText> : null}
          {i.public_contact_email ? <a href={"mailto:" + i.public_contact_email} className={buttonStyles("secondary","md")}>Email investor</a> : null}
          {i.public_contact_phone ? <a href={"tel:" + i.public_contact_phone} className={buttonStyles("secondary","md")}>Call investor</a> : null}
          {publicWhatsApp ? <a href={publicWhatsApp} target="_blank" rel="noopener noreferrer nofollow" className={buttonStyles("secondary","md")}>WhatsApp</a> : null}
          {publicTelegram ? <a href={publicTelegram} target="_blank" rel="noopener noreferrer nofollow" className={buttonStyles("secondary","md")}>Telegram</a> : null}
          {publicFacebook ? <a href={publicFacebook} target="_blank" rel="noopener noreferrer nofollow" className={buttonStyles("secondary","md")}>Facebook</a> : null}
          {publicOther ? <a href={publicOther} target="_blank" rel="noopener noreferrer nofollow" className={buttonStyles("secondary","md")}>Other contact</a> : null}
          {acceptsIntroductions ? <Link href={user ? ("/dashboard/investor/submit?investorId=" + i.id) : ("/login?next=" + encodeURIComponent("/dashboard/investor/submit?investorId=" + i.id))} className={buttonStyles("primary", "md")}>{user ? "Request an introduction" : "Sign in to request an introduction"}</Link> : null}
          {claimable ? <Link href={user ? ("/dashboard/investor?investorId=" + i.id) : ("/login?next=" + encodeURIComponent("/dashboard/investor?investorId=" + i.id))} className={buttonStyles("secondary", "md")}>{user ? "Claim this investor listing" : "Sign in to claim this listing"}</Link> : null}
          <ReportDialog targetType="investor" targetId={i.id} targetName={i.name} signedIn={Boolean(user)} loginHref={loginHref} />
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {i.thesis ? <Card><CardHeader><h2 className="font-semibold">Publicly stated thesis</h2></CardHeader><CardBody><p className="whitespace-pre-line text-[15px] leading-relaxed">{i.thesis}</p></CardBody></Card> : null}
          <Alert tone="info" title="About investor listings">Details are taken from what the organisation says publicly. Buna doesn’t verify fund sizes, portfolios or track records, doesn’t broker investments and doesn’t imply that any investor endorses any startup.</Alert>
        </div>
        <aside className="space-y-4">
          <Card><CardHeader><h2 className="font-semibold">Focus</h2></CardHeader><CardBody className="space-y-4 text-sm">
            {i.country ? <div><p className="text-muted">Based in</p><p className="font-medium">{countryName(i.country) ?? i.country}</p></div> : null}
            {i.regions.length > 0 ? <div><p className="text-muted">Regions</p><p className="font-medium">{i.regions.join(", ")}</p></div> : null}
            {i.investor_type ? <div><p className="text-muted">Investor type</p><p className="font-medium">{i.investor_type.replace(/_/g, " ")}</p></div> : null}
            {i.investment_min !== null || i.investment_max !== null ? <div><p className="text-muted">Typical investment range</p><p className="font-medium">{i.investment_min == null ? "—" : Number(i.investment_min).toLocaleString()} – {i.investment_max == null ? "—" : Number(i.investment_max).toLocaleString()} {i.investment_currency}</p></div> : null}
            {i.portfolio ? <div><p className="text-muted">Portfolio</p><p className="font-medium">{i.portfolio}</p></div> : null}
            {i.stages.length > 0 ? <div><p className="text-muted">Stages</p><div className="mt-1 flex flex-wrap gap-1.5">{i.stages.map((s) => <Badge key={s} tone="green">{stageLabel(s) ?? s}</Badge>)}</div></div> : null}
            {i.sectors.length > 0 ? <div><p className="text-muted">Sectors</p><div className="mt-1 flex flex-wrap gap-1.5">{i.sectors.map((s) => <Badge key={s}>{s.replace(/-/g, " ")}</Badge>)}</div></div> : null}
          </CardBody></Card>
        </aside>
      </div>
    </div>
  );
}
