import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DeleteAccountForm } from "@/components/account/delete-account-form";
import { requireProfile, requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await requireProfile("/dashboard/settings");
  const user = await requireUser("/dashboard/settings");
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Settings</h1><p className="mt-1 text-sm text-muted">Your account, your data.</p></div>
      <Card>
        <CardHeader><h2 className="font-semibold">Account</h2></CardHeader>
        <CardBody className="space-y-2 text-sm">
          <p><span className="text-muted">Email:</span> {user.email} {user.email_confirmed_at ? <Badge tone="green">Confirmed</Badge> : <Badge tone="warning">Not confirmed</Badge>}</p>
          <p><span className="text-muted">Username:</span> <Link href={`/users/${profile.username}`} className="font-medium no-underline hover:underline">@{profile.username}</Link> · <Link href={`/users/${profile.username}`}>view public page</Link></p>
          <p><span className="text-muted">Member since:</span> {formatDate(profile.created_at)}</p>
          <p className="flex flex-wrap gap-x-4 gap-y-1 pt-2"><Link href="/dashboard/profile" className="font-medium">Edit profile and privacy</Link><Link href="/dashboard/notifications" className="font-medium">Notification preferences</Link><Link href="/dashboard/security" className="font-medium">Password and devices</Link></p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Download your data</h2></CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-muted">A JSON file with your profile, preferences, startups you’re on, launches, comments, votes, follows, saved opportunities, notifications and reports you filed.</p>
          <a href="/dashboard/settings/export" download className={buttonStyles("secondary", "md")}><Download className="h-4 w-4" aria-hidden="true" />Download my data</a>
        </CardBody>
      </Card>
      <Card>
        <CardHeader><h2 className="font-semibold text-danger">Delete account</h2></CardHeader>
        <CardBody className="space-y-4">
          <Alert tone="warning" title="This can’t be undone">Your profile, votes, follows and notifications are deleted and your comments are removed. Companies are not deleted with a person — see what happens in the <Link href="/privacy">Privacy Policy</Link>. If you’re the only owner of a startup with other team members, make someone else an owner first.</Alert>
          <DeleteAccountForm username={profile.username} />
        </CardBody>
      </Card>
    </div>
  );
}
