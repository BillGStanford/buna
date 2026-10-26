import type { Metadata } from "next";

// Authentication pages are never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-primary-pale">
      <div className="container-page flex min-h-[calc(100vh-8rem)] items-center justify-center py-10">
        <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-sm sm:p-8">{children}</div>
      </div>
    </div>
  );
}
