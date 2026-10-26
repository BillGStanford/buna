import type { Metadata } from "next";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { SignOutOthers } from "@/components/forms/sign-out-others";
import { requireUser } from "@/lib/auth/session";
import { changePasswordAction } from "./actions";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  const user = await requireUser("/dashboard/security");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Security</h1>
        <p className="mt-1 text-sm text-muted">Manage how you sign in.</p>
      </div>
      <Card>
        <CardHeader><h2 className="font-semibold">Email</h2></CardHeader>
        <CardBody className="flex flex-wrap items-center gap-3">
          <span className="text-sm">{user.email}</span>
          {user.email_confirmed_at ? <Badge tone="green">Confirmed</Badge> : <Badge tone="warning">Not confirmed</Badge>}
        </CardBody>
      </Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Change password</h2></CardHeader>
        <CardBody><ResetPasswordForm action={changePasswordAction} submitLabel="Change password" /></CardBody>
      </Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Devices</h2></CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-muted">Signed in somewhere you don’t trust? This signs you out everywhere except this device.</p>
          <SignOutOthers />
        </CardBody>
      </Card>
    </div>
  );
}
