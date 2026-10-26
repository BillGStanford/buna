import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/content/prose";

export const metadata: Metadata = { title: "Help", description: "How Buna works: publishing a startup, launches and voting, opportunities, messages, teams, your data and more.", alternates: { canonical: "/help" } };

const FAQ: { q: string; a: React.ReactNode }[] = [
  { q: "How do I add my startup?", a: <>Create an account and confirm your email, then go to <Link href="/dashboard/startup/new">Add your startup</Link>. It starts as a private draft: add a one-line description, an About section, a sector and a country, preview it, and press Publish. You can unpublish at any time.</> },
  { q: "Why can’t I publish?", a: "Publishing needs a confirmed email address and a complete profile (one-line description, about text, sector and country). The Publishing tab lists exactly what’s missing. If your startup was removed or rejected by the Buna team it can’t be republished — contact us." },
  { q: "What does “Verified” mean?", a: "A Verified badge means the Buna team reviewed evidence about the startup (for example a registration document or official website) and found it consistent. It is not an endorsement, and it doesn’t say anything about the company’s finances or future. Without a badge, information is provided by the startup and hasn’t been reviewed. You can request verification from your startup’s Verification tab; you don’t need a registered company to be listed." },
  { q: "How do launches work?", a: <>Submit a product at <Link href="/launches/submit">Submit a launch</Link>. It stays private until a moderator approves it; you’re notified of the decision. If you choose a future launch date it appears under Upcoming and goes live on that date. Once live, signed-in members with a confirmed email can vote and comment.</> },
  { q: "Can I change or remove my vote?", a: "No. Votes are final — that keeps rankings honest. Trending favours launches that keep earning votes: a vote’s weight halves every 24 hours." },
  { q: "How do I report something?", a: "Use the Report button on a startup, launch, comment, opportunity, investor or member. The team reviews every report. Reports are not shown to the person reported." },
  { q: "How do opportunities work?", a: "Each listing links to its original source and application page and shows when we last checked it. Closed opportunities are labelled as closed and never shown as open. Save an opportunity to see it in your dashboard and get a reminder in the last three days before its deadline." },
  { q: "How do I contact a startup?", a: "Use the “Contact this startup” form on its page. The message goes to the startup’s team, who reply to your email address directly. Buna doesn’t read or reply to these messages." },
  { q: "How do I add teammates?", a: "Open your startup’s Team tab, enter their email and a role. They receive a one-time invitation link and must sign in with that email address to accept. Owners can invite admins, editors and viewers; admins can invite editors and viewers." },
  { q: "How do I list myself in the founder directory?", a: <>In <Link href="/dashboard/profile">your profile</Link>, turn on “Show my bio, headline and website on my public profile” and “List me in the founder directory”. Your email and phone number are never shown.</> },
  { q: "How do I download or delete my data?", a: <>Go to <Link href="/dashboard/settings">Settings</Link>. You can download a copy of your data as JSON and permanently delete your account. See the <Link href="/privacy">Privacy Policy</Link> for what is removed and what is kept.</> },
  { q: "I didn’t get an email.", a: "Check your spam folder, then use “Resend confirmation email” on the sign-in page. Make sure you typed the address correctly. If it still doesn’t arrive, contact us." },
  { q: "Something is wrong or I need help.", a: <>Use the <Link href="/contact">contact form</Link> and tell us what you were doing and what you expected.</> },
];

export default function HelpPage() {
  return (
    <>
      <PageHeader title="Help" intro="Answers to the most common questions. Can’t find yours? Use the contact page." />
      <div className="container-page max-w-3xl space-y-3 py-10">
        {FAQ.map((f) => (
          <details key={f.q} className="group rounded-lg border border-line bg-surface open:bg-primary-pale/40">
            <summary className="cursor-pointer list-none px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden"><span className="mr-2 inline-block text-primary transition-transform group-open:rotate-90" aria-hidden="true">›</span>{f.q}</summary>
            <div className="px-4 pb-4 pl-9 text-[15px] leading-relaxed text-ink">{f.a}</div>
          </details>
        ))}
      </div>
    </>
  );
}
