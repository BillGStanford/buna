import type { Metadata } from "next";
import { Card, CardBody } from "@/components/ui/card";
import { ProfileForm } from "@/components/forms/profile-form";
import { AvatarForm } from "@/components/forms/avatar-form";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

export const metadata: Metadata = { title: "Edit profile" };

export default async function ProfilePage() {
  const profile = await requireProfile("/dashboard/profile");
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, slug, name").eq("is_active", true).order("sort_order");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your profile</h1>
        <p className="mt-1 text-sm text-muted">Control how you appear on Buna.</p>
      </div>
      <Card><CardBody><AvatarForm name={profile.display_name} avatarUrl={profile.avatar_url} /></CardBody></Card>
      <Card><CardBody className="py-6"><ProfileForm profile={profile} categories={(data ?? []) as Category[]} /></CardBody></Card>
    </div>
  );
}
