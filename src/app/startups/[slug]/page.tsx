import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { BadgeCheck, CalendarDays, ExternalLink, Eye, Globe, MapPin, Rocket } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ReportDialog } from "@/components/startups/report-dialog";
import { ShareButton } from "@/components/startups/share-button";
import { StartupLogo } from "@/components/startups/startup-logo";
import { WebsiteFavicon } from "@/components/websites/website-favicon";
import { getUser } from "@/lib/auth/session";
import { getSiteUrl } from "@/lib/env";
import { countryName } from "@/lib/geo";
import { linkKindLabel, stageLabel, VERIFICATION_LABELS } from "@/lib/startups/constants";
import { getStartupProfile, resolveRetiredSlug } from "@/lib/startups/queries";
import { canEditStartup } from "@/lib/permissions";
import { InquiryForm } from "@/components/people/inquiry-form";
import { getProfile } from "@/lib/auth/session";
import { FollowButton } from "@/components/social/follow-button";
import { LaunchList } from "@/components/launches/launch-card";
import { getStartupLaunches } from "@/lib/launches/queries";
import { followerCount, isFollowing } from "@/lib/social/queries";
import { getInvestorPortal } from "@/lib/investors/queries";
import { SaveStartupForInvestorButton } from "@/components/investors/save-startup-button";\nimport { requestStartupDocumentsAction } from "@/app/dashboard/investor/actions";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ slug: string }> };

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = SLUG_RE.test(slug.toLowerCase()) ? await getStartupProfile(slug.toLowerCase()) : null;
  if (!s) return { title: "Startup not found", robots: { index: false } };
  const description = (s.tagline || s.description || `${s.name} on Buna`).slice(0, 160);
  const indexable = s.status === "published" && !s.is_demo;
  return {
    title: s.name,
    description,
    alternates: { canonical: `/startups/${s.slug}` },
    robots: indexable ? undefined : { index: false, follow: false },
    openGraph: {
      type: "website",
      title: s.tagline ? `${s.name} — ${s.tagline}` : s.name,
      description,
      url: `/startups/${s.slug}`,
    },
    twitter: { card: "summary_large_image", title: s.name, description },
  };
}

function safeExternal(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

const hostOf = (url: string) => { try { return new URL(url).host.replace(/^www\./, ""); } catch { return url; } };

export default async function StartupProfilePage({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.toLowerCase();
  if (!SLUG_RE.test(slug)) notFound();

  const s = await getStartupProfile(slug);
  if (!s) {
    const current = await resolveRetiredSlug(slug);
    if (current) permanentRedirect(`/startups/${current}`);
    notFound();
  }
  if (slug !== rawSlug) permanentRedirect(`/startups/${s.slug}`);

  const user = await getUser();
  const viewerProfile = user ? await getProfile() : null;
  const isPreview = s.status !== "published";
  const investorPortal = user && !s.is_demo ? await getInvestorPortal(user.id) : null;
  let investorHasSaved = false;
  if (investorPortal?.investor && !isPreview) {
    const supabase = await createClient();
    const { data: savedRow } = await supabase.from("investor_saved_startups").select("startup_id").eq("investor_id", investorPortal.investor.id).eq("startup_id", s.id).maybeSingle();
    investorHasSaved = Boolean(savedRow);
  }
  const location = [s.city, countryName(s.country)].filter(Boolean).join(", ");
  const stage = stageLabel(s.stage);
  const site = s.website_url ? safeExternal(s.website_url) : null;
  const supabase = await createClient();
  const foundingSupporterIds = new Set((await Promise.all(s.team.map(async (member) => {
    const { data } = await supabase.rpc("member_is_founding_supporter", { p_user: member.user_id });
    return data ? member.user_id : null;
  }))).filter((id): id is string => Boolean(id)));
  const pageUrl = `${getSiteUrl()}/startups/${s.slug}`;
  const paragraphs = (s.description ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const canEdit = canEditStartup(s.viewerRole);
  const [launches, followers, following] = await Promise.all([
    isPreview ? Promise.resolve([]) : getStartupLaunches(s.id, user?.id ?? null).catch(() => []),
    isPreview ? Promise.resolve(0) : followerCount("startup", s.id).catch(() => 0),
    isFollowing(user?.id ?? null, "startup", s.id).catch(() => false),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: s.name,
    url: site ?? pageUrl,
    description: s.tagline ?? undefined,
    logo: s.logo_url ?? undefined,
    foundingDate: s.founded_year ? String(s.founded_year) : undefined,
    address: s.country ? { "@type": "PostalAddress", addressCountry: s.country, addressLocality: s.city ?? undefined } : undefined,
    sameAs: s.links.map((l) => safeExternal(l.url)).filter(Boolean),
  };

  return (
    <div className="container-page space-y-6 py-8">
      {!s.is_demo && !isPreview ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      ) : null}

      {isPreview ? (
        <Alert tone="warning" title="Preview — only your team can see this page">
          This startup is <strong>{s.status.replace("_", " ")}</strong>.{" "}
          {canEdit ? <Link href={`/dashboard/startup/${s.id}/settings`} className="font-medium">Open publishing settings</Link> : null}
        </Alert>
      ) : null}
      {s.is_demo ? <Alert tone="info" title="Demo listing">This is a fictional company used to preview Buna. It is not a real startup.</Alert> : null}

      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <StartupLogo name={s.name} src={s.logo_url} websiteUrl={site} size={88} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold">{s.name}</h1>
            {s.verification_status === "verified" ? (
              <Badge tone="green"><BadgeCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />Verified</Badge>
            ) : null}
          </div>
          {s.tagline ? <p className="mt-2 max-w-2xl text-lg text-muted">{s.tagline}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {s.category ? <Badge tone="green">{s.category.name}</Badge> : null}
            {stage ? <Badge>{stage}</Badge> : null}
            {s.tags.map((t) => <Badge key={t}>{t}</Badge>)}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {site ? (
              <a href={site} target="_blank" rel="noopener noreferrer nofollow" className={buttonStyles("primary", "md")}>
                <WebsiteFavicon url={site} size={18} />Visit website<ExternalLink className="h-4 w-4" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : null}
            {!isPreview ? <FollowButton targetType="startup" targetId={s.id} name={s.name} following={following} count={followers} signedIn={Boolean(user)} loginHref={`/login?next=${encodeURIComponent(`/startups/${s.slug}`)}`} returnTo={`/startups/${s.slug}`} /> : null}
            {investorPortal?.investor && !isPreview ? <SaveStartupForInvestorButton startupId={s.id} saved={investorHasSaved} /> : null}\n            {investorPortal?.investor && !isPreview ? <form action={requestStartupDocumentsAction} className="inline-flex items-center gap-2"><input type="hidden" name="startupId" value={s.id}/><input name="message" aria-label="Message to startup team" placeholder="Message (optional)" className="w-36 rounded-md border border-line bg-canvas px-2 py-2 text-xs"/><button type="submit" className={buttonStyles("secondary","sm")}>Request data room</button></form> : null}
            <ShareButton url={pageUrl} title={s.name} />
            {!isPreview ? (
              <ReportDialog targetType="startup" targetId={s.id} targetName={s.name} signedIn={Boolean(user)} loginHref={`/login?next=${encodeURIComponent(`/startups/${s.slug}`)}`} />
            ) : null}
            {canEdit ? <Link href={`/dashboard/startup/${s.id}`} className={buttonStyles("ghost", "sm")}>Edit profile</Link> : null}
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader><h2 className="font-semibold">About</h2></CardHeader>
            <CardBody className="space-y-3">
              {paragraphs.length > 0 ? paragraphs.map((p, i) => <p key={i} className="whitespace-pre-line text-[15px] leading-relaxed">{p}</p>) : (
                <p className="text-sm text-muted">This startup hasn’t written a description yet.</p>
              )}
            </CardBody>
          </Card>

          {(s.problem_statement || s.solution || s.market_opportunity || s.target_customers.length || s.target_geographies.length) ? (
            <Card>
              <CardHeader><h2 className="font-semibold">Problem, solution and market</h2></CardHeader>
              <CardBody className="space-y-4">
                {s.problem_statement ? <div><h3 className="text-sm font-semibold">Problem</h3><p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{s.problem_statement}</p></div> : null}
                {s.solution ? <div><h3 className="text-sm font-semibold">Solution</h3><p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{s.solution}</p></div> : null}
                {s.target_customers.length ? <div><h3 className="text-sm font-semibold">Target customers</h3><div className="mt-1 flex flex-wrap gap-1.5">{s.target_customers.map((x) => <Badge key={x}>{x}</Badge>)}</div></div> : null}
                {s.target_geographies.length ? <div><h3 className="text-sm font-semibold">Target geographies</h3><div className="mt-1 flex flex-wrap gap-1.5">{s.target_geographies.map((x) => <Badge key={x}>{x}</Badge>)}</div></div> : null}
                {s.market_opportunity ? <div><h3 className="text-sm font-semibold">Market opportunity</h3><p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{s.market_opportunity}</p></div> : null}
                {s.business_model ? <div><h3 className="text-sm font-semibold">Business model</h3><p className="mt-1 text-sm">{s.business_model}</p></div> : null}
              </CardBody>
            </Card>
          ) : null}
          {(s.fundraising_status !== "not_raising" || s.funding_round || s.funding_target != null) ? (
            <Card>
              <CardHeader><h2 className="font-semibold">Fundraising</h2></CardHeader>
              <CardBody className="flex flex-wrap gap-3 text-sm">
                {s.fundraising_status !== "not_raising" ? <Badge tone={s.fundraising_status === "raising" ? "green" : "neutral"}>{s.fundraising_status.replace(/_/g, " ")}</Badge> : null}
                {s.funding_round ? <span>Round: <strong>{s.funding_round.replace(/_/g, " ")}</strong></span> : null}
                {s.funding_target != null ? <span>Target: <strong>{s.funding_currency} {Number(s.funding_target).toLocaleString()}</strong></span> : null}
              </CardBody>
            </Card>
          ) : null}

          {s.products.length > 0 ? (
            <Card>
              <CardHeader><h2 className="font-semibold">Products and services</h2></CardHeader>
              <CardBody>
                <ul className="divide-y divide-line">
                  {s.products.map((p) => {
                    const url = p.url ? safeExternal(p.url) : null;
                    return (
                      <li key={p.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-mint text-primary-deep"><Rocket className="h-4 w-4" aria-hidden="true" /></span>
                        <div className="min-w-0">
                          <h3 className="font-medium">
                            {url ? <a href={url} target="_blank" rel="noopener noreferrer nofollow">{p.name}<span className="sr-only"> (opens in a new tab)</span></a> : p.name}
                          </h3>
                          {p.description ? <p className="mt-0.5 text-sm text-muted">{p.description}</p> : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          {launches.length > 0 ? (
            <section aria-labelledby="launches-heading" className="space-y-3">
              <h2 id="launches-heading" className="text-lg font-semibold">Launches</h2>
              <LaunchList launches={launches} signedIn={Boolean(user)} />
            </section>
          ) : null}

          {s.media.length > 0 ? (
            <Card>
              <CardHeader><h2 className="font-semibold">Screenshots</h2></CardHeader>
              <CardBody>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {s.media.map((m) => (
                    <li key={m.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.url} alt={m.alt_text ?? `${s.name} screenshot`} loading="lazy" decoding="async" className="aspect-video w-full rounded-md border border-line object-cover" />
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          {!isPreview ? (
            <Card id="contact">
              <CardHeader><h2 className="font-semibold">Contact this startup</h2></CardHeader>
              <CardBody><InquiryForm startupId={s.id} startupName={s.name} defaultName={viewerProfile?.display_name} defaultEmail={user?.email ?? undefined} /></CardBody>
            </Card>
          ) : null}

          {s.team.length > 0 ? (
            <Card>
              <CardHeader><h2 className="font-semibold">Team</h2></CardHeader>
              <CardBody>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {s.team.map((m) => (
                    <li key={m.user_id} className="flex items-center gap-3">
                      <Avatar name={m.display_name} src={m.avatar_url} size={44} />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 truncate font-medium"><Link href={`/users/${m.username}`} className="no-underline hover:underline">{m.display_name || `@${m.username}`}</Link>{foundingSupporterIds.has(m.user_id) ? <Badge tone="green">Founding Supporter</Badge> : null}</p>
                        {m.public_title ? <p className="truncate text-sm text-muted">{m.public_title}</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader><h2 className="font-semibold">Details</h2></CardHeader>
            <CardBody>
              <dl className="space-y-3 text-sm">
                {location ? <div className="flex gap-2"><dt className="sr-only">Location</dt><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" /><dd>{location}</dd></div> : null}
                {s.founded_year ? <div className="flex gap-2"><dt className="sr-only">Founded</dt><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" /><dd>Founded in <span className="tabular-nums">{s.founded_year}</span></dd></div> : null}
                {site ? <div className="flex gap-2"><dt className="sr-only">Website</dt><Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" /><dd className="flex min-w-0 items-center gap-2 truncate"><WebsiteFavicon url={site} size={16} /><a href={site} target="_blank" rel="noopener noreferrer nofollow">{hostOf(site)}</a></dd></div> : null}
                <div className="flex gap-2">
                  <dt className="sr-only">Verification</dt><Eye className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  <dd>{VERIFICATION_LABELS[s.verification_status] ?? VERIFICATION_LABELS.unverified}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          {s.links.length > 0 ? (
            <Card>
              <CardHeader><h2 className="font-semibold">Links</h2></CardHeader>
              <CardBody>
                <ul className="space-y-2 text-sm">
                  {s.links.map((l) => {
                    const url = safeExternal(l.url);
                    return url ? (
                      <li key={l.id}>
                        <a href={url} target="_blank" rel="noopener noreferrer nofollow">{l.label || linkKindLabel(l.kind)}</a>
                        <span className="text-muted"> · {hostOf(url)}</span>
                        <span className="sr-only"> (opens in a new tab)</span>
                      </li>
                    ) : null;
                  })}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          <p className="text-xs leading-relaxed text-muted">
            Details are provided by the startup. Buna reviews information only where a listing is marked verified, and verification is not an endorsement or a guarantee of any kind.
          </p>
        </aside>
      </div>
    </div>
  );
}
