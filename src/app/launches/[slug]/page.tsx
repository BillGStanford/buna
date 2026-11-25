import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { CalendarDays, ExternalLink, PlayCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CommentThread } from "@/components/launches/comment-thread";
import { LaunchList } from "@/components/launches/launch-card";
import { VoteButton } from "@/components/launches/vote-button";
import { LaunchReminderButton } from "@/components/launches/launch-reminder-button";
import { ReportDialog } from "@/components/startups/report-dialog";
import { ShareButton } from "@/components/startups/share-button";
import { StartupLogo } from "@/components/startups/startup-logo";
import { WebsiteFavicon } from "@/components/websites/website-favicon";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/session";
import { getSiteUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { LAUNCH_STATUS_LABELS } from "@/lib/launches/constants";
import { countVisible } from "@/lib/launches/comments";
import { getComments, getLaunchPage, getRelatedLaunches } from "@/lib/launches/queries";
import { listCategories } from "@/lib/startups/queries";

type Props = { params: Promise<{ slug: string }> };
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function safeExternal(url: string): string | null {
  try { const u = new URL(url); return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null; } catch { return null; }
}
const hostOf = (url: string) => { try { return new URL(url).host.replace(/^www\./, ""); } catch { return url; } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const user = await getUser();
  const l = SLUG_RE.test(slug.toLowerCase()) ? await getLaunchPage(slug.toLowerCase(), user?.id ?? null) : null;
  if (!l) return { title: "Launch not found", robots: { index: false } };
  const description = (l.tagline || l.description || `${l.name} on Buna`).slice(0, 160);
  const indexable = l.status === "published" && !l.is_demo;
  return {
    title: `${l.name} — ${l.tagline}`.slice(0, 70),
    description,
    alternates: { canonical: `/launches/${l.slug}` },
    robots: indexable ? undefined : { index: false, follow: false },
    openGraph: { type: "website", title: `${l.name} — ${l.tagline}`, description, url: `/launches/${l.slug}` },
    twitter: { card: "summary_large_image", title: l.name, description },
  };
}

export default async function LaunchPageRoute({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.toLowerCase();
  if (!SLUG_RE.test(slug)) notFound();
  const user = await getUser();
  const launch = await getLaunchPage(slug, user?.id ?? null);
  if (!launch) notFound();
  if (slug !== rawSlug) permanentRedirect(`/launches/${launch.slug}`);

  const live = launch.status === "published";
  const competitionActive = live && (!launch.competition_ends_at || new Date(launch.competition_ends_at).getTime() > Date.now());
  const upcoming = launch.status === "scheduled";
  const visibleToAll = live || upcoming;
  const [comments, categories] = await Promise.all([getComments(launch.id).catch(() => []), listCategories().catch(() => [])]);
  const related = live ? await getRelatedLaunches(launch, categories, user?.id ?? null).catch(() => []) : [];
  const productUrl = safeExternal(launch.product_url);
  const video = launch.demo_video_url ? safeExternal(launch.demo_video_url) : null;
  const pageUrl = `${getSiteUrl()}/launches/${launch.slug}`;
  const loginHref = `/login?next=${encodeURIComponent(`/launches/${launch.slug}`)}`;
  const statusInfo = LAUNCH_STATUS_LABELS[launch.status];
  const paragraphs = (launch.description ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const total = countVisible(comments);
  const maker = launch.maker;
  const supabase = await createClient();
  const { data: reminder } = user && upcoming ? await supabase.from("launch_reminders").select("launch_id").eq("launch_id", launch.id).eq("user_id", user.id).maybeSingle() : { data: null };
  const { data: makerFoundingSupporter } = maker ? await supabase.rpc("member_is_founding_supporter", { p_user: maker.id }) : { data: false };

  return (
    <div className="container-page space-y-6 py-8">
      {!visibleToAll && statusInfo ? (
        <Alert tone={launch.status === "rejected" || launch.status === "removed" ? "error" : "warning"} title={`${statusInfo.label} — only you and moderators can see this page`}>
          {statusInfo.help}
          {launch.moderation_note ? <> <strong>Moderator note:</strong> {launch.moderation_note}</> : null}{" "}
          {launch.canEdit ? <Link href={`/dashboard/launches/${launch.id}`} className="font-medium">Manage this launch</Link> : null}
        </Alert>
      ) : null}
      {upcoming ? <Alert tone="info" title={`Launching ${launch.launch_date ? formatDate(launch.launch_date) : "soon"}`}>Voting and comments open when this launch goes live.</Alert> : null}
      {live && !competitionActive ? <Alert tone="info" title="This competition has ended">The 24-hour voting period is over. The product page and its discussion remain available in Buna’s permanent discovery archive.</Alert> : null}
      {launch.is_demo ? <Alert tone="info" title="Demo launch">This is a fictional product used to preview Buna.</Alert> : null}

      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <StartupLogo name={launch.name} src={launch.logo_url ?? launch.startup?.logo_url} size={88} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold">{launch.name}</h1>
            {launch.is_featured ? <Badge tone="green">Featured</Badge> : null}
          </div>
          <p className="mt-2 max-w-2xl text-lg text-muted">{launch.tagline}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {launch.category ? <Badge tone="green">{launch.category.name}</Badge> : null}
            {launch.tags.map((t) => <Link key={t} href={`/launches?tag=${encodeURIComponent(t)}`} className="no-underline"><Badge>#{t}</Badge></Link>)}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {productUrl ? (
              <a href={productUrl} target="_blank" rel="noopener noreferrer nofollow" className={buttonStyles("primary", "md")}>
                <WebsiteFavicon url={productUrl} size={18} />Visit product<ExternalLink className="h-4 w-4" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : null}
            {video ? (
              <a href={video} target="_blank" rel="noopener noreferrer nofollow" className={buttonStyles("secondary", "md")}>
                <PlayCircle className="h-4 w-4" aria-hidden="true" />Watch demo<span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : null}
            {upcoming ? <LaunchReminderButton launchId={launch.id} following={Boolean(reminder)} signedIn={Boolean(user)} loginHref={loginHref} /> : null}
            {visibleToAll ? <ShareButton url={pageUrl} title={launch.name} /> : null}
            {(live || launch.canEdit) ? <details className="relative ml-auto"><summary aria-label="More launch actions" className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-line text-lg text-muted hover:bg-surface">•••</summary><div className="absolute right-0 z-20 mt-2 min-w-40 rounded-lg border border-line bg-canvas p-2 shadow-lg">{live ? <div className="px-2 py-1"><ReportDialog targetType="launch" targetId={launch.id} targetName={launch.name} signedIn={Boolean(user)} loginHref={loginHref}/></div> : null}{launch.canEdit ? <Link href={`/dashboard/launches/${launch.id}`} className="block rounded px-2 py-2 text-sm text-ink no-underline hover:bg-surface">Edit launch</Link> : null}</div></details> : null}
          </div>
        </div>
        <VoteButton launchId={launch.id} name={launch.name} count={launch.vote_count} voted={launch.voted} signedIn={Boolean(user)} loginHref={loginHref} canVote={launch.canVote}
          disabledReason={!live ? "Voting opens when the launch is live" : !competitionActive ? "This 24-hour competition has ended" : undefined} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          {launch.media.length > 0 ? <Card><CardHeader><h2 className="font-semibold">Product gallery</h2></CardHeader><CardBody><ul className="-mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-2">{launch.media.map((m) => <li key={m.id} className="w-[min(82vw,34rem)] shrink-0 snap-start">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={m.url} alt={m.alt_text ?? launch.name + " screenshot"} loading="lazy" decoding="async" className="aspect-video w-full rounded-lg border border-line object-cover"/></li>)}</ul></CardBody></Card> : null}
          <Card><CardHeader><h2 className="font-semibold">About this product</h2></CardHeader><CardBody className="space-y-3">{paragraphs.length > 0 ? paragraphs.map((p, i) => <p key={i} className="whitespace-pre-line text-[15px] leading-relaxed">{p}</p>) : <p className="text-sm text-muted">No description yet.</p>}</CardBody></Card>

          {visibleToAll ? (
            <Card id="discussion">
              <CardHeader><h2 className="font-semibold">Discussion <span className="font-normal text-muted tabular-nums">({total})</span></h2></CardHeader>
              <CardBody>
                {total === 0 ? <div className="mb-4 rounded-lg border border-dashed border-line bg-surface p-4"><p className="font-medium">Have a question about {launch.name}?</p><p className="mt-1 text-sm text-muted">Start the discussion and connect with the maker.</p></div> : null}
                <CommentThread launchId={launch.id} comments={comments} viewerId={user?.id ?? null} canComment={competitionActive} loginHref={loginHref}/>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card><CardHeader><h2 className="font-semibold">Final result</h2></CardHeader><CardBody><p className="text-xs font-medium uppercase tracking-wide text-muted">Community votes</p><div className="mt-1 flex items-end justify-between gap-3"><p className="text-3xl font-bold tabular-nums">{launch.vote_count.toLocaleString()}</p>{launch.is_featured ? <Badge tone="green">Featured</Badge> : null}</div><p className="mt-2 text-xs text-muted">{competitionActive ? "Voting is still open" : "24-hour competition complete"}</p></CardBody></Card>
          <Card><CardHeader><h2 className="font-semibold">People & details</h2></CardHeader><CardBody className="space-y-4">
            {maker ? <div className="flex items-center gap-3"><Avatar name={maker.display_name} src={maker.avatar_url} size={44}/><div className="min-w-0"><Link href={"/users/" + maker.username} className="block truncate font-medium text-ink no-underline hover:underline">{maker.display_name || "@" + maker.username}</Link><p className="truncate text-sm text-muted">@{maker.username}</p>{makerFoundingSupporter ? <Badge tone="green">Founding Supporter</Badge> : null}</div></div> : null}
            {launch.startup ? <div className="flex items-center gap-3 border-t border-line pt-4"><StartupLogo name={launch.startup.name} src={launch.startup.logo_url} size={36}/><Link href={"/startups/" + launch.startup.slug} className="min-w-0 truncate font-medium text-ink no-underline hover:underline">{launch.startup.name}</Link></div> : null}
            <div className="border-t border-line pt-4"><ul className="space-y-3 text-sm"><li className="flex gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true"/><span>{upcoming ? "Launches " : "Launched "}{formatDate(launch.launch_date ?? launch.published_at)}</span></li>{productUrl ? <li className="flex min-w-0 items-center gap-2 truncate text-muted"><WebsiteFavicon url={productUrl} size={16}/>{hostOf(productUrl)}</li> : null}</ul></div>
          </CardBody></Card>
          {related.length > 0 ? <Card><CardHeader><h2 className="font-semibold">Related launches</h2></CardHeader><CardBody><LaunchList launches={related.slice(0,3)} signedIn={Boolean(user)}/></CardBody></Card> : null}
          <p className="text-xs leading-relaxed text-muted">Launches may be published instantly or reviewed, depending on platform settings. Competition voting is time-limited and reflects community interest, not a Buna endorsement.</p>
        </aside>
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="related-heading" className="space-y-3">
          <h2 id="related-heading" className="text-xl font-bold">More in {launch.category?.name}</h2>
          <LaunchList launches={related} signedIn={Boolean(user)} />
        </section>
      ) : null}
    </div>
  );
}
