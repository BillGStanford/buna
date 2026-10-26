import { StatusPage } from "@/components/layout/status-page";

export default function StartupNotFound() {
  return (
    <StatusPage code="404" title="This startup isn’t here"
      actions={[{ label: "Browse startups", href: "/startups" }, { label: "Go to the homepage", href: "/", variant: "secondary" }]}>
      It may have been renamed, unpublished or removed, or the link may have a typo.
    </StatusPage>
  );
}
