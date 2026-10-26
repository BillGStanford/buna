import { StatusPage } from "@/components/layout/status-page";

export default function UserNotFound() {
  return <StatusPage code="404" title="We can’t find that member" actions={[{ label: "Browse launches", href: "/launches" }, { label: "Go to the homepage", href: "/", variant: "secondary" }]}>The username may have changed, or the account no longer exists.</StatusPage>;
}
