"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";

export function CopyReferralLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  return (
    <button type="button" onClick={copy} className={buttonStyles("primary", "md")}>
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      {copied ? "Copied" : "Copy referral link"}
    </button>
  );
}
