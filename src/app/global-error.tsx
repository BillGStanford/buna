"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.5rem", color: "#172B24" }}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>Buna is having trouble</h1>
        <p style={{ color: "#64746B", maxWidth: "32rem" }}>Something went wrong while loading the site. Please try again.</p>
        <button onClick={reset} style={{ marginTop: "1.25rem", background: "#087F5B", color: "#fff", border: 0, borderRadius: 6, padding: "0.6rem 1rem", fontWeight: 600 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
