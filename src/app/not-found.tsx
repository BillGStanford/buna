import { StatusPage } from "@/components/layout/status-page";

export default function NotFound() {
  return (
    <StatusPage code="404" title="We can’t find that page">
      The link may be broken, or the page may have moved or been removed.
    </StatusPage>
  );
}
