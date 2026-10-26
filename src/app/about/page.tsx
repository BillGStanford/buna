import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { HeroIllustration } from "@/components/illustrations";
import { Prose, PageHeader } from "@/components/content/prose";

export const metadata: Metadata = { title: "About Buna", description: "Buna is a home for African technology startups and the people who back them — starting in Ethiopia.", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <>
      <PageHeader title="About Buna" intro="A home for African technology startups — where founders get discovered and the people looking for them can find them." />
      <div className="container-page grid gap-10 py-10 lg:grid-cols-[1fr_22rem] lg:items-start">
        <Prose>
          <h2 className="!mt-0">Why Buna exists</h2>
          <p>Great African startups are easy to miss. Their products are spread across social feeds, pitch decks and word of mouth, and the programmes, grants and investors that could help them are just as scattered. Buna puts startups, launches, opportunities and people in one place, in the open, with a stable link for each.</p>
          <p>The name comes from the Amharic word for coffee — the thing people gather around to talk. We’re starting in Ethiopia and building for the whole continent.</p>
          <h2>What you can do</h2>
          <ul>
            <li><strong>Founders:</strong> publish a startup profile with your products, links and team; launch what you’re building and get votes and feedback; list yourself in the founder directory; receive messages from customers and partners.</li>
            <li><strong>Everyone else:</strong> discover startups by sector, country and stage; follow the ones you like; save opportunities and get reminded before deadlines; contact a startup directly.</li>
            <li><strong>Ecosystem organisations:</strong> investors, accelerators and universities can be listed with what they publicly say they look for.</li>
          </ul>
          <h2>How we work</h2>
          <ul>
            <li><strong>Honest numbers.</strong> Counts on Buna come from real activity. We don’t invent users, votes or success stories.</li>
            <li><strong>Information has a source.</strong> Startup details come from the startup; opportunities link to their original source and show when we last checked them; a “verified” badge only appears after we’ve reviewed something.</li>
            <li><strong>Your data, your choice.</strong> Profiles are private until you publish them, you choose what is public, and you can export or delete your account any time.</li>
            <li><strong>Votes are final.</strong> Votes can’t be changed or removed, so they mean something.</li>
            <li><strong>Free to use.</strong> There are no ads and nothing is for sale in the rankings.</li>
          </ul>
          <h2>Where we are</h2>
          <p>Buna is new. The directory grows as founders publish their companies, and we review launches and opportunities by hand. If something is wrong or missing, tell us on the <Link href="/contact">contact page</Link>.</p>
          <div className="mt-8 flex flex-wrap gap-3 not-prose">
            <Link href="/startups" className={buttonStyles("primary", "md")}>Discover startups</Link>
            <Link href="/signup" className={buttonStyles("secondary", "md")}>Add your startup</Link>
          </div>
        </Prose>
        <HeroIllustration className="hidden lg:block" />
      </div>
    </>
  );
}
