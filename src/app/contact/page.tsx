import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Illustration } from "@/components/illustrations";
import { PageHeader } from "@/components/content/prose";
import { ContactForm } from "@/components/people/contact-form";
import { getProfile, getUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Contact", description: "Get in touch with the Buna team.", alternates: { canonical: "/contact" } };

export default async function ContactPage() {
  const user = await getUser();
  const profile = user ? await getProfile() : null;
  const support = process.env.SUPPORT_EMAIL?.trim();
  return (
    <>
      <PageHeader title="Contact us" intro="Questions, problems, privacy requests or partnership ideas — we read everything." />
      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_20rem]">
        <Card><CardBody className="py-6"><ContactForm defaultName={profile?.display_name} defaultEmail={user?.email ?? undefined} /></CardBody></Card>
        <aside className="space-y-4">
          <Illustration name="inbox" className="mx-auto w-44" />
          <div className="space-y-2 text-sm text-muted">
            <p>We usually reply by email. Please don’t include passwords or financial details.</p>
            <p>To reach a startup, use the contact form on its own page — messages to the team here aren’t forwarded to startups.</p>
            {support ? <p className="flex items-center gap-2 text-ink"><Mail className="h-4 w-4" aria-hidden="true" /><a href={`mailto:${support}`}>{support}</a></p> : null}
          </div>
        </aside>
      </div>
    </>
  );
}
