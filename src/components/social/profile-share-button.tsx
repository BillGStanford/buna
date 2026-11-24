"use client";

import * as React from "react";
import { Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ProfileShareButton({ username }: { username: string }) {
  const [copied, setCopied] = React.useState(false);
  const { toast } = useToast();
  async function shareProfile() {
    const url = `${window.location.origin}/users/${encodeURIComponent(username)}`;
    if (navigator.share) {
      try { await navigator.share({ title: `@${username} on Buna`, url }); return; }
      catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Profile link copied.", "success");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Couldn’t copy the link. Copy the profile address from your browser.", "error");
    }
  }
  return (
    <Button type="button" variant="secondary" size="sm" onClick={shareProfile}>
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
      {copied ? "Copied" : "Share profile"}
    </Button>
  );
}
