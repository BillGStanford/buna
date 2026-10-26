import type { Metadata } from "next";
import Link from "next/link";
import { Prose, PageHeader } from "@/components/content/prose";

export const metadata: Metadata = { title: "Community Guidelines", description: "How to take part in Buna, what isn’t allowed, and how moderation works.", alternates: { canonical: "/guidelines" } };

export default function GuidelinesPage() {
  return (
    <>
      <PageHeader title="Community Guidelines" intro="Buna works because people can trust what they see. These rules keep it that way." updated="2026-10-20" />
      <div className="container-page py-10">
        <Prose>
          <h2 className="!mt-0">Be real</h2>
          <ul>
            <li>Use your own name and represent your own company. Don’t impersonate people, startups, investors or organisations.</li>
            <li>Keep listings accurate. Don’t claim funding, customers, awards, partnerships or verification you don’t have.</li>
            <li>One person, one account. Don’t create accounts to vote, comment or review your own work.</li>
          </ul>
          <h2>Be fair</h2>
          <ul>
            <li><strong>Votes:</strong> vote for products you genuinely find interesting. Don’t trade votes, pay for votes, run vote rings or use automation. Votes are final, so make them count.</li>
            <li><strong>Comments:</strong> be specific and civil. Critique the product, not the person. No harassment, hate, threats or sexual content.</li>
            <li><strong>Launches:</strong> submit real products you’re allowed to launch. Don’t resubmit the same product repeatedly or submit products only to harvest links.</li>
          </ul>
          <h2>Be safe</h2>
          <ul>
            <li>No spam, scams, phishing, malware or misleading links. Links must go where they say they go.</li>
            <li>Don’t share other people’s private information. Don’t put passwords, financial details or ID numbers in messages.</li>
            <li>Opportunity listings and investor profiles must be accurate and sourced. No fake grants, fake deadlines or investment solicitations.</li>
            <li>Buna doesn’t broker investments or sell securities. Don’t use the platform to solicit money from the public.</li>
            <li>Nothing illegal, and nothing that infringes others’ rights.</li>
          </ul>
          <h2>Messages to startups</h2>
          <p>Use the contact form to reach out for a real reason. Unsolicited bulk messages, repeated messages after someone hasn’t replied, and messages stuffed with links are treated as spam.</p>
          <h2>How moderation works</h2>
          <ul>
            <li><strong>Reports.</strong> Anyone signed in can report a startup, launch, comment, opportunity, investor or member. A person can report each thing once. Reports are reviewed by the Buna team; the person reported isn’t told who reported them.</li>
            <li><strong>Launch review.</strong> Launches are reviewed before they go live. If a launch needs changes, we tell you what to fix and you can resubmit.</li>
            <li><strong>Actions.</strong> Depending on severity we may hide or remove content, unpublish a startup, remove a launch, or suspend an account. Suspended accounts can sign in and read, but can’t post, vote, comment, follow or publish.</li>
            <li><strong>Verification</strong> is a review of evidence, not a guarantee. It can be withdrawn if we learn it was wrong.</li>
            <li><strong>Records.</strong> Moderation decisions are logged internally so they can be reviewed.</li>
            <li><strong>Appeals.</strong> If you think we got it wrong, write to us through the <Link href="/contact">contact page</Link> and tell us what happened. A different team member reviews appeals where possible.</li>
          </ul>
          <p>These guidelines are part of our <Link href="/terms">Terms</Link>. We may update them; the date above shows the latest version.</p>
        </Prose>
      </div>
    </>
  );
}
