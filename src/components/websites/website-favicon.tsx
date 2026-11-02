"use client";

import { useState } from "react";

type Props = { url?: string | null; size?: number; className?: string; label?: string };

export function WebsiteFavicon({ url, size = 20, className = "", label = "Website icon" }: Props) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/favicon?url=${encodeURIComponent(url)}`}
      alt={label}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`inline-block shrink-0 rounded-sm object-contain ${className}`}
    />
  );
}
