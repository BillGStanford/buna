import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { CalendarClock, ExternalLink, Globe2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SaveOpportunityButton } from "@/components/opportunities/save-button";
import { ReportDialog } from "@/components/startups/report-dialog";
import { ShareButton } from "@/components/startups/share-button";
import { getProfile, getUser } from "@/lib/auth/session";
import { getSiteUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { countryName } from "@/lib/geo";
import { categoryLabel } from "@/lib/opportunities/constants";
import { deadlineState, describeDeadline } from "@/lib/opportunities/params";
import { getOpportunity } from "@/lib/opportunities/queries";
import { isStaff } from "@/lib/permissions";

type Props = { params: Promise<{ slug: string }> };
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const safe = (url: string | null) => { if (!url) return null; try { const u = new URL(url); return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null; } catch { return null; } };
const host = (url: string) => { try { return new URL(url).host.replace(/^www\./, ""); } catch { return url; } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const user = await getUser();
  const o = SLUG_RE.test(slug.toLowerCase()) ? await getOpportunity(slug.toLowerCase(), user?.id ?? null) : null;
  if (!o) return { title: "Opportunity not found", robots: { index: false } };
  const description = (o.description || `${o.title} from ${o.organization}`).slice(0, 160);
  return {
    title: `${o.title} — ${o.organization}`.slice(0, 70), description, alternates: { canonical: `/opportunities/${o.slug}` },
    robots: o.status === "published" && !o.is_demo ? undefined : { index: false, follow: false },
    openGraph: { type: "website", title: o.title, description, url: `/opportunities/${o.slug}` }, twitter: { card: "summary_large_image", title: o.title, description },
  };
}

export default async function OpportunityPage({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.toLowerCase();
  if (!SLUG_RE.test(slug)) notFound();
  const user = await getUser();
  const o = await getOpportunity(slug, user?.id ?? null);
  if (!o) notFound();
  if (slug !== rawSlug) permanentRedirect(`/opportunities/${o.slug}`);
  const profile = user ? await getProfile() : null;

  const state = deadlineState(o.status, o.deadline);
  const closed = state.kind === "closed";
  const preview = o.status === "draft" || o.status === "archived";
  const apply = safe(o.application_url);
  const source = safe(o.source_url);
  const where = o.countries.length === 0 ? "Open to all of Africa" : o.countries.map((c) => countryName(c) ?? c).join(", ");
  const paragraphs = (o.description ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const loginHref = `/login?next=${encodeURIComponent(`/opportunities/${o.slug}`)}`;

  return (
    <div className="container-page space-y-6 py-8">
      {preview ? <Alert tone="warning" title={`${o.status === "draft" ? "Draft" : "Archived"} — visible to staff only`}>{isStaff(profile?.role) ? <Link href="/admin/opportunities" className="font-medium">Manage in admin</Link> : null}</Alert> : null}
      {closed && !preview ? <Alert tone="error" title="This opportunity has closed">The deadline has passed. It’s kept here for reference — check the source for future rounds.</Alert> : null}
      {o.is_demo ? <Alert tone="info" title="Demo listing">This is a fictional programme used to preview Buna. It is not a real opportunity.</Alert> : null}

      <header className="max-w-3xl space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="green">{categoryLabel(o.category)}</Badge>
          <Badge tone={closed ? "danger" : state.kind === "open" && state.daysLeft <= 7 ? "warning" : "neutral"}><CalendarClock className="mr-1 h-3 w-3" aria-hidden="true" />{describeDeadline(state)}</Badge>
        </div>
        <h1 className="text-3xl font-bold">{o.title}</h1>
        <p className="text-lg text-muted">{o.organization}</p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {apply && !closed ? <a href={apply} target="_blank" rel="noopener noreferrer nofollow" className={buttonStyles("primary", "md")}>Apply<ExternalLink className="h-4 w-4" aria-hidden="true" /><span className="sr-only"> (opens the organiser’s application page in a new tab)</span></a> : null}
          {source ? <a href={source} target="_blank" rel="noopener noreferrer nofollow" className={buttonStyles("secondary", "md")}>View original source<ExternalLink className="h-4 w-4" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a> : null}
          <SaveOpportunityButton opportunityId={o.id} title={o.title} saved={o.saved} signedIn={Boolean(user)} loginHref={loginHref} returnTo={`/opportunities/${o.slug}`} size="md" />
          <ShareButton url={`${getSiteUrl()}/opportunities/${o.slug}`} title={o.title} />
          {!preview ? <ReportDialog targetType="opportunity" targetId={o.id} targetName={o.title} signedIn={Boolean(user)} loginHref={loginHref} /> : null}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Card><CardHeader><h2 className="font-semibold">About this opportunity</h2></CardHeader><CardBody className="space-y-3">{paragraphs.length > 0 ? paragraphs.map((p, i) => <p key={i} className="whitespace-pre-line text-[15px] leading-relaxed">{p}</p>) : <p className="text-sm text-muted">No description provided — see the original source.</p>}</CardBody></Card>
          {o.eligibility ? <Card><CardHeader><h2 className="font-semibold">Eligibility</h2></CardHeader><CardBody><p className="whitespace-pre-line text-[15px] leading-relaxed">{o.eligibility}</p></CardBody></Card> : null}
        </div>
        <aside className="space-y-4">
          <Card>
            <CardHeader><h2 className="font-semibold">Key details</h2></CardHeader>
            <CardBody>
              <dl className="space-y-3 text-sm">
                <div><dt className="text-muted">Deadline</dt><dd className="font-medium">{o.deadline ? <time dateTime={o.deadline}>{formatDate(o.deadline)}</time> : "Rolling — no fixed deadline"}</dd></div>
                <div className="flex gap-2"><Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" /><div><dt className="sr-only">Who can apply</dt><dd>{where}</dd></div></div>
                {source ? <div><dt className="text-muted">Source</dt><dd className="break-all">{host(source)}</dd></div> : null}
                <div><dt className="text-muted">Last checked by Buna</dt><dd>{o.last_checked_at ? <time dateTime={o.last_checked_at}>{formatDate(o.last_checked_at)}</time> : "Not recorded"}</dd></div>
                {o.published_date ? <div><dt className="text-muted">Published by the organiser</dt><dd><time dateTime={o.published_date}>{formatDate(o.published_date)}</time></dd></div> : null}
              </dl>
            </CardBody>
          </Card>
          <p className="text-xs leading-relaxed text-muted">Buna collects opportunity details from the sources linked here and isn’t affiliated with the organisers unless stated. Details can change — confirm deadlines and eligibility with the organiser. A listing is not an endorsement.</p>
        </aside>
      </div>
    </div>
  );
}
