"use client";

import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ShareButton({ url, title }: { url: string; title: string }) {
  const { toast } = useToast();
  async function share() {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast("Link copied to your clipboard.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return; // user closed the share sheet
      toast(`Couldn’t copy automatically. The link is ${url}`, "error");
    }
  }
  return (
    <Button variant="secondary" size="sm" onClick={share}>
      <Share2 className="h-4 w-4" aria-hidden="true" />Share
    </Button>
  );
}
