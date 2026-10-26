import type { Metadata } from "next";
import Link from "next/link";
import { Prose, PageHeader } from "@/components/content/prose";
import { operatorName } from "@/config/site";

export const metadata: Metadata = { title: "Terms of Service", description: "The rules for using Buna.", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <>
      <PageHeader title="Terms of Service" intro="The agreement between you and the operator of Buna." updated="2026-10-20" />
      <div className="container-page py-10">
        <Prose>
          <h2 className="!mt-0">1. Who we are and what this covers</h2>
          <p>Buna is operated by {operatorName} (“we”, “us”). By creating an account or using Buna you agree to these Terms, our <Link href="/guidelines">Community Guidelines</Link> and our <Link href="/privacy">Privacy Policy</Link>. If you don’t agree, please don’t use Buna. You must be at least 16 years old to create an account.</p>
          <h2>2. Your account</h2>
          <ul>
            <li>Give accurate information and keep it up to date. Confirm your email address to use features that publish content.</li>
            <li>You’re responsible for your password and for activity on your account. Tell us if you think it’s been compromised.</li>
            <li>One person may hold one account. Accounts can’t be sold or transferred.</li>
          </ul>
          <h2>3. Your content</h2>
          <p>You own what you post (profiles, startup details, launches, comments, images). By posting it you give us a non-exclusive, worldwide, royalty-free licence to host, display, reproduce and distribute it on and in connection with Buna — including in search results, share previews and emails about your content — for as long as it’s on Buna and for a reasonable period afterwards while it clears from backups. You confirm you have the right to post it and that it doesn’t break the law or anyone’s rights.</p>
          <h2>4. Acceptable use</h2>
          <p>Follow the Community Guidelines. Don’t scrape or overload the service, probe or bypass its security, use automation to vote or message, or collect other people’s information for purposes they haven’t agreed to.</p>
          <h2>5. Listings, verification and information on Buna</h2>
          <ul>
            <li>Startup, launch, founder and investor information is provided by its owners. Opportunity information is collected from the sources we link to. We try to keep things accurate but can’t guarantee it.</li>
            <li>A “Verified” badge means we reviewed certain evidence at a point in time. It is not an endorsement or a statement about legitimacy of every claim, financial strength, investment quality or future success.</li>
            <li>Buna is not a broker, adviser or marketplace for securities. Nothing on Buna is an offer to sell or a solicitation to buy any investment, or financial, legal or professional advice. Do your own research before dealing with anyone you find here.</li>
            <li>Messages you send through Buna go to the recipient’s team. We aren’t a party to what happens next.</li>
          </ul>
          <h2>6. Moderation, suspension and removal</h2>
          <p>We may review, hide or remove content, unpublish startups or launches, and suspend or close accounts that break these Terms or the Guidelines, or to protect people or the service. Where we can, we’ll tell you why. You can appeal through the <Link href="/contact">contact page</Link>.</p>
          <h2>7. Ending your account</h2>
          <p>You can delete your account in <Link href="/dashboard/settings">Settings</Link>. The Privacy Policy explains what happens to your data, including that companies are not deleted with a person. If you’re the only owner of a startup that still has other team members, you must transfer ownership first.</p>
          <h2>8. Intellectual property and takedowns</h2>
          <p>Buna’s name, logo, design and software belong to us or our licensors. If you believe content on Buna infringes your rights, send us the details through the <Link href="/contact">contact page</Link> and we’ll look into it.</p>
          <h2>9. Availability and changes to the service</h2>
          <p>Buna is provided “as is” and “as available”. We may change, suspend or discontinue features, and the service may be interrupted. We’ll try to give notice of significant changes.</p>
          <h2>10. Liability</h2>
          <p>To the extent the law allows, we’re not liable for indirect or consequential losses, lost profits or lost data, or for content posted by others or dealings between users. Nothing in these Terms limits liability that can’t be limited by law.</p>
          <h2>11. Changes to these Terms</h2>
          <p>We may update these Terms. If a change is significant we’ll tell you in the product or by email and the date above will change. Using Buna after a change means you accept it.</p>
          <h2>12. Governing law and contact</h2>
          <p>These Terms are governed by the laws that apply where the operator of Buna is established, and disputes go to the courts there, except where mandatory consumer law says otherwise. Questions? Use the <Link href="/contact">contact page</Link>.</p>
        </Prose>
      </div>
    </>
  );
}
