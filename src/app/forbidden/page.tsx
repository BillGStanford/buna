import type { Metadata } from "next";
import { StatusPage } from "@/components/layout/status-page";

export const metadata: Metadata = { title: "Not allowed", robots: { index: false } };

export default async function ForbiddenPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { reason } = await searchParams;
  return (
    <StatusPage code="403" title={reason === "suspended" ? "Your account is suspended" : "You don’t have access to this page"}
      actions={[{ label: "Go to the homepage", href: "/" }]}>
      {reason === "suspended"
        ? "Suspended accounts can’t create or change public content. If you think this is a mistake, contact the Buna team."
        : "Your account doesn’t have permission to view this. If you expected access, check you’re signed in with the right account."}
    </StatusPage>
  );
}
