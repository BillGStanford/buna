import { StatusPage } from "@/components/layout/status-page";

export default function LaunchNotFound() {
  return (
    <StatusPage code="404" title="This launch isn’t here" actions={[{ label: "Browse launches", href: "/launches" }, { label: "Go to the homepage", href: "/", variant: "secondary" }]}>
      It may not have been approved yet, or it was removed, or the link has a typo.
    </StatusPage>
  );
}
