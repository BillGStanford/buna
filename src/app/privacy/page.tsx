import type { Metadata } from "next";
import Link from "next/link";
import { Prose, PageHeader } from "@/components/content/prose";
import { operatorName } from "@/config/site";

export const metadata: Metadata = { title: "Privacy Policy", description: "What Buna collects, why, who processes it, and the choices you have.", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <>
      <PageHeader title="Privacy Policy" intro="What we collect, why, who handles it, and what you can do about it. This describes how Buna works today." updated="2026-11-08" />
      <div className="container-page py-10">
        <Prose>
          <h2 className="!mt-0">1. Who is responsible</h2>
          <p>{operatorName} operates Buna and decides how your personal data is used. For privacy questions or requests, use the <Link href="/contact">contact page</Link> and choose “Privacy or my data”.</p>

          <h2>2. What we collect</h2>
          <table>
            <thead><tr><th>Data</th><th>Why</th><th>Visible to others?</th></tr></thead>
            <tbody>
              <tr><td><strong>Account:</strong> email address, password (stored only as a salted hash by our authentication provider — we never see it), the date you accepted these terms.</td><td>Create and secure your account; send verification and security emails.</td><td>No. Your email is never shown publicly.</td></tr>
              <tr><td><strong>Profile:</strong> display name, username, photo, and — if you provide them — headline, bio, country, city, role, interests, expertise, website, what you’re open to.</td><td>Show who you are on comments, launches and startups; power the founder directory.</td><td>Name, username and photo: yes. Everything else only if you turn on a public profile; your location only if you also choose to show it; directory listing only if you opt in.</td></tr>
              <tr><td><strong>Your content:</strong> startup profiles, products, links, images, launches, comments, votes, follows, saved opportunities, reports you file, team memberships.</td><td>Provide the features you use.</td><td>Published startups, launches, comments and team listings you make public: yes. Votes, follows, saved items and reports: no (follower <em>counts</em> are public).</td></tr>
              <tr><td><strong>Messages you send:</strong> the form contents and your email address when you contact a startup or us.</td><td>Deliver your message.</td><td>Only to the startup’s team (or our staff).</td></tr>
              <tr><td><strong>Verification evidence</strong> you upload for a startup.</td><td>Review a verification request.</td><td>No. Stored privately; only that startup’s owners/admins and our staff can open it.</td></tr>
              <tr><td><strong>Technical:</strong> your IP address and email address are combined into one-way hashes to rate-limit sign-ups, messages and other actions; sign-in session cookies; server logs kept by our hosting provider.</td><td>Prevent abuse and keep the service running.</td><td>No. The rate-limit hashes are deleted within a day.</td></tr>
              <tr><td><strong>Startup audience analytics:</strong> a random first-party visitor ID and short-lived session ID when you view a published startup profile, the profile path, referring domain or campaign source, country-level location where available, and a broad device category.</td><td>Give startup teams aggregate information about discovery, engagement, and returning audiences.</td><td>Only aggregated totals are shown to the startup team. We do not expose individual visitor identities.</td></tr>
            </tbody>
          </table>
          <p>We don’t sell personal data or show ads. Buna’s startup analytics are first-party and limited to published startup profiles; they do not follow you across other websites. We do not store raw IP addresses, full referrer URLs, email addresses, or browser fingerprints in analytics. We don’t knowingly collect data from anyone under 16.</p>

          <h2>3. Who processes your data for us</h2>
          <ul>
            <li><strong>Supabase</strong> — our database, authentication and file storage provider.</li>
            <li><strong>Vercel</strong> — hosts the website and runs scheduled jobs.</li>
            <li><strong>Resend</strong> — sends transactional email (confirmations, notifications, messages and invitations) when email is configured.</li>
          </ul>
          <p>These providers handle data on our behalf under their own terms and may process it in countries other than yours. We share data with others only if the law requires it, or to protect people or the service.</p>

          <h2>4. Cookies</h2>
          <p>Buna uses sign-in cookies and, when you view a published startup profile, first-party random visitor and session identifiers to measure aggregate startup audience activity. The visitor identifier is retained for up to 13 months; the session identifier expires after one day. You can block or clear site storage in your browser, though this may make audience counts less complete. These identifiers are not used for cross-site advertising or profiling.</p>

          <h2>5. Emails we send</h2>
          <p>Account emails (verification, password reset) are always sent. Notification emails — comments and replies on your launches, decisions on your launches, messages to your startup, team invitations — follow the preferences in your <Link href="/dashboard/notifications">notification settings</Link>. Deadline reminders for opportunities you saved are in-app unless you turn email on. We don’t send marketing email.</p>

          <h2>6. How long we keep data</h2>
          <ul>
            <li>Your account data and content stay until you delete them or your account.</li>
            <li>Rate-limit hashes: removed within about a day.</li>
            <li>Raw startup audience events: retained for up to 13 months; aggregate daily counts are retained while the startup listing exists.</li>
            <li>Notifications and messages: kept while your account exists.</li>
            <li>Moderation and security records (an audit log of who changed what) are kept so decisions can be reviewed; they identify staff and the affected item, not private message content.</li>
            <li>Backups held by our providers expire on their own schedule.</li>
          </ul>

          <h2>7. Your choices and rights</h2>
          <ul>
            <li><strong>See and edit</strong> your information in your <Link href="/dashboard/profile">profile</Link>, and control what’s public.</li>
            <li><strong>Download</strong> a copy of your data as JSON in <Link href="/dashboard/settings">Settings</Link>.</li>
            <li><strong>Delete your account</strong> in Settings. See below for what that does.</li>
            <li>Ask us to correct, restrict or provide other data we hold, or object to how we use it, via the <Link href="/contact">contact page</Link>. Depending on where you live you may have additional legal rights; we’ll respect them.</li>
          </ul>

          <h2>8. What deleting your account does</h2>
          <ul>
            <li>Your profile, votes, follows, saved items, notifications and preferences are deleted. Your vote is removed from launch counts.</li>
            <li>Your comments are removed (replies by others remain under a “removed” placeholder).</li>
            <li>Companies are never deleted with a person. If you’re the only owner of a startup with other team members, you must first make someone else an owner. A startup you ran alone is unpublished and kept, unowned, until our team reviews it; ask us to delete it fully if you want that.</li>
            <li>Launches you made on behalf of a startup stay, no longer attributed to you. Launches with no startup are removed.</li>
            <li>Messages you sent to startups remain with those teams but your name and email are replaced with “Deleted user”.</li>
            <li>Moderation and security records are kept as described above.</li>
          </ul>

          <h2>9. Security</h2>
          <p>Access to data is controlled in the database itself, passwords are hashed, uploads are checked, and sensitive actions are rate-limited and logged. No system is perfectly secure; if we learn of a breach affecting you we’ll tell you.</p>

          <h2>10. Changes</h2>
          <p>If we change this policy in a meaningful way we’ll tell you in the product or by email, and update the date above.</p>
        </Prose>
      </div>
    </>
  );
}
