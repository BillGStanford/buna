import type { Metadata } from "next";
import { StatusPage } from "@/components/layout/status-page";

export const metadata: Metadata = { title: "Sign in required", robots: { index: false } };

export default function UnauthorizedPage() {
  return (
    <StatusPage code="401" title="Sign in to continue"
      actions={[{ label: "Sign in", href: "/login" }, { label: "Create an account", href: "/signup", variant: "secondary" }]}>
      You need to be signed in to view this page.
    </StatusPage>
  );
}
