"use client";

import { usePathname } from "next/navigation";
import { BookOpen, Info } from "lucide-react";

const help: Record<string, { title: string; purpose: string; workflow: string; caution: string }> = {
  "/admin/reports": {
    title: "How to use Reports",
    purpose: "This is the moderation inbox for content or accounts that people have flagged. A report is a request to investigate, not proof that a rule was broken.",
    workflow: "Open the reported item and read its context → decide whether it violates Buna’s rules → take the narrowest appropriate action or dismiss the report when it is unfounded.",
    caution: "Do not remove content or penalize an account based only on the existence of a report. Check the evidence first.",
  },
  "/admin/startups": {
    title: "How to use Startups",
    purpose: "This is the administrative list of startup profiles. Use it to review submissions, check listing status and take moderation actions on startup records.",
    workflow: "Filter by status or search by name → open the listing and inspect its details → approve, reject, unpublish or take another available action with a clear reason.",
    caution: "A public correction request is reviewed separately. Do not treat a founder’s proposed change as approved until the review is complete.",
  },
  "/admin/launches": {
    title: "How to use Launches",
    purpose: "This is the launch review queue. It controls which startup launches can appear in Buna’s launch discovery experience.",
    workflow: "Review pending launches → check the startup, description and links → approve or reject. Use published controls for changes to already-live launches.",
    caution: "Approval makes a launch visible to the community. Check that the submission is legitimate and ready to be public.",
  },
  "/admin/community": {
    title: "How to use Community",
    purpose: "This area manages community discussions and replies. It is for content moderation, not for editing startup profiles.",
    workflow: "Read the thread and replies in context → hide content that breaks the rules → restore it if it was hidden in error, or remove it when the available policy allows.",
    caution: "Prefer hiding while investigating uncertain cases. Do not remove legitimate criticism simply because it is negative.",
  },
  "/admin/opportunities": {
    title: "How to use Opportunities",
    purpose: "This is the directory of grants, accelerators and other useful opportunities for founders.",
    workflow: "Search or filter the opportunity → verify the organizer, eligibility, deadline and application link → update, publish, unpublish or archive it using the available controls.",
    caution: "Expired deadlines and broken application links mislead founders. Check dates and links before publishing.",
  },
  "/admin/investors": {
    title: "How to use Investors",
    purpose: "This manages investor directory listings that founders can discover on Buna.",
    workflow: "Search existing entries or create a listing → confirm the investor’s identity and public details → set its publication and verification state using the available controls.",
    caution: "A directory listing is not an endorsement or a guarantee that an investor will fund a company.",
  },
  "/admin/company-data": {
    title: "How to use Company data",
    purpose: "This is the evidence review workspace for company claims, metrics and funding-round information submitted about startups.",
    workflow: "Open each claim or metric → inspect its evidence and source → accept, dispute or reject it using the review controls and visibility options.",
    caution: "Do not mark an unsupported claim as verified. Keep source quality and whether information should be public in mind.",
  },
  "/admin/company-sources": {
    title: "How to use Data sources",
    purpose: "This area manages external sources and records that may contribute company information to Buna.",
    workflow: "Review the source details → inspect proposed company records and matching confidence → approve or reject records only after checking the source URL and company match.",
    caution: "A source record is a lead for review, not automatically a verified company fact.",
  },
  "/admin/investor-applications": {
    title: "How to use Investor applications",
    purpose: "This queue contains applications from people requesting investor access or status.",
    workflow: "Review the applicant’s identity, professional background, track record and evidence → approve only when the information supports the request, or reject with a clear reason.",
    caution: "Do not approve based only on a job title, social profile or self-declared investor status.",
  },
  "/admin/referral-rewards": {
    title: "How to use Referral rewards",
    purpose: "This queue contains requests for Buna referral-related recognition and rewards.",
    workflow: "Open the request → check the member’s eligibility and referral history → approve or reject the request and leave a staff note where appropriate.",
    caution: "Check the actual eligibility criteria before granting a reward. Do not promise a reward before approval.",
  },
  "/admin/users": {
    title: "How to use Users",
    purpose: "This is the account management area. It helps staff find users and respond to account abuse or access issues.",
    workflow: "Search for the account → review its profile and relevant history → suspend or restore access when justified. Admins can also manage platform roles where permitted.",
    caution: "Suspension affects a real person’s ability to use Buna. Record a clear reason and never change your own role.",
  },
  "/admin/messages": {
    title: "How to use Messages",
    purpose: "This is Buna’s contact inbox for messages sent to the platform team.",
    workflow: "Open new messages → read the sender’s question and contact details → mark handled when addressed or spam when it is unwanted.",
    caution: "Messages may contain private contact information. Use it only to respond to the request.",
  },
  "/admin/featured": {
    title: "How to use Featured",
    purpose: "This controls which published startups receive a featured placement in discovery.",
    workflow: "Review the current featured picks → search for a published startup → add or remove a featured placement based on Buna’s editorial criteria.",
    caution: "Featured placement should be an editorial decision, not a paid guarantee or a substitute for verification.",
  },
  "/admin/operations": {
    title: "How to use Operations",
    purpose: "This is the administrative operations desk for support, disputes and bulk platform tasks that do not fit the normal review queues.",
    workflow: "Support tickets: update status and priority. Disputes: investigate and resolve. Corrections: compare proposed and current company details before approval. Duplicate merges: choose the correct surviving startup. Imports: preview and validate before applying. Announcements: check audience and message before sending. Campaigns: set dates and cancel when needed.",
    caution: "Merges, imports, announcements and campaigns can affect many users or records. Preview first, use test data when learning, and double-check recipients and dates before confirming.",
  },
  "/admin/analytics": {
    title: "How to use Analytics",
    purpose: "This is the platform performance view. It helps you understand traffic, signups, onboarding and launch activity over time.",
    workflow: "Check the date window and event totals → compare related steps such as visitors, signups and onboarding → use changes in the numbers to decide what needs investigation.",
    caution: "Analytics show patterns, not the reason behind them. Do not treat correlation as proof that a particular change caused a result.",
  },
  "/admin/verification": {
    title: "How to use Verification",
    purpose: "This is the queue for startup verification requests and the list of startups that currently hold verified status.",
    workflow: "Inspect the submitted evidence and source documents → compare them with the startup’s public identity → approve or reject. Revoke verification if later evidence shows it is no longer justified.",
    caution: "A verification badge means evidence was reviewed and found consistent; it is not an endorsement. Do not approve based only on a logo or account ownership.",
  },
  "/admin/categories": {
    title: "How to use Categories",
    purpose: "Categories are the broad sectors used to organize startups, launches and discovery filters.",
    workflow: "Create a category only when it represents a useful distinct sector → keep its name and slug clear → deactivate categories that should no longer be offered.",
    caution: "Deactivation preserves existing references. Changing a slug can change public filter links, so check where it is used first.",
  },
  "/admin/tags": {
    title: "How to use Tags",
    purpose: "Tags are the shared, more specific labels used to describe and filter platform content.",
    workflow: "Create or edit a tag with a clear name and description → deactivate outdated or duplicate labels instead of deleting them → check the audit log after important changes.",
    caution: "Inconsistent or duplicate tags make discovery worse. Keep the vocabulary concise and consistent.",
  },
  "/admin/audit": {
    title: "How to use the Audit log",
    purpose: "This is the accountability record of administrative changes across Buna.",
    workflow: "Filter by action or record type → inspect the actor, affected record and timestamp → use the details to investigate unexpected changes or confirm that an action occurred.",
    caution: "The audit log is for investigation and accountability. Do not assume an entry alone explains the full context of a decision.",
  },
  "/admin/settings": {
    title: "How to use Settings",
    purpose: "These are platform-wide controls that change how Buna behaves for users and future submissions.",
    workflow: "Read the current setting and both outcomes → decide which policy Buna should apply → save the change, then verify the behavior with a test account.",
    caution: "Settings can affect every new submission. Change one at a time, document why, and test the resulting user experience.",
  },
};

export function AdminPageHelp() {
  const pathname = usePathname();
  const page = help[pathname];
  if (!page) return null;

  return (
    <aside aria-label={page.title} className="mb-6 rounded-xl border border-primary/20 bg-primary-pale/40 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary"><BookOpen size={17} /></span>
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2"><Info size={14} className="text-primary" /><h2 className="text-sm font-bold text-ink">{page.title}</h2></div>
          <p className="text-sm leading-relaxed text-ink">{page.purpose}</p>
          <p className="text-sm leading-relaxed text-muted"><strong className="text-ink">Typical workflow: </strong>{page.workflow}</p>
          <p className="text-sm leading-relaxed text-muted"><strong className="text-ink">Be careful: </strong>{page.caution}</p>
        </div>
      </div>
    </aside>
  );
}
