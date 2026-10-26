import { StatusPage } from "@/components/layout/status-page";

export default function OpportunityNotFound() {
  return <StatusPage code="404" title="This opportunity isn’t here" actions={[{ label: "Browse opportunities", href: "/opportunities" }, { label: "Go to the homepage", href: "/", variant: "secondary" }]}>It may have been removed or archived, or the link has a typo.</StatusPage>;
}
