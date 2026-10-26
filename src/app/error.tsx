"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ level: "error", scope: "ui", message: "unhandled render error", digest: error.digest }));
  }, [error]);
  return (
    <div className="container-page flex min-h-[55vh] flex-col items-start justify-center gap-4 py-16">
      <p className="text-sm font-semibold text-primary">Something went wrong</p>
      <h1 className="text-3xl font-bold">We hit a problem loading this page</h1>
      <p className="max-w-lg text-muted">It’s on our side, not yours. Try again — if it keeps happening, come back in a few minutes.</p>
      {error.digest ? <p className="text-xs text-muted">Reference: <span className="tabular-nums">{error.digest}</span></p> : null}
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
