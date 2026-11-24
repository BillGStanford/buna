"use client";

import * as React from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ProfileShareButton({ username }: { username: string }) {
  const [copied, setCopied] = React.useState(false);
  const { toast } = useToast();
  const profileUrl = () => `${window.location.origin}/users/${encodeURIComponent(username)}`;

  async function copyProfile() {
    try {
      await navigator.clipboard.writeText(profileUrl());
      setCopied(true);
      toast("Profile link copied.", "success");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Couldn’t copy the link. Copy the profile address from your browser.", "error");
    }
  }

  async function shareProfile() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `@${username} on Buna`, url: profileUrl() });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copyProfile();
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={copyProfile}>
        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        {copied ? "Copied" : "Copy link"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={shareProfile}>
        <Share2 className="h-4 w-4" aria-hidden="true" />
        Share
      </Button>
    </div>
  );
}
