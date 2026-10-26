import Link from "next/link";
import { Logo } from "./logo";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-primary-pale">
      <div className="container-page flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm space-y-2">
          <Logo />
          <p className="text-sm text-muted">{siteConfig.tagline}</p>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-6 text-sm sm:max-w-xl sm:grid-cols-3 sm:justify-items-start">
          <nav aria-label="Explore" className="space-y-2"><p className="font-semibold">Explore</p>
            <ul className="space-y-1.5">
              <li><Link href="/startups" className="text-ink no-underline hover:underline">Startups</Link></li>
              <li><Link href="/launches" className="text-ink no-underline hover:underline">Launches</Link></li>
              <li><Link href="/opportunities" className="text-ink no-underline hover:underline">Opportunities</Link></li>
              <li><Link href="/founders" className="text-ink no-underline hover:underline">Founders</Link></li>
              <li><Link href="/investors" className="text-ink no-underline hover:underline">Investors</Link></li>
            </ul></nav>
          <nav aria-label="Buna" className="space-y-2"><p className="font-semibold">Buna</p>
            <ul className="space-y-1.5">
              <li><Link href="/about" className="text-ink no-underline hover:underline">About</Link></li>
              <li><Link href="/help" className="text-ink no-underline hover:underline">Help</Link></li>
              <li><Link href="/contact" className="text-ink no-underline hover:underline">Contact</Link></li>
              <li><Link href="/signup" className="text-ink no-underline hover:underline">Create account</Link></li>
            </ul></nav>
          <nav aria-label="Legal" className="space-y-2"><p className="font-semibold">Legal</p>
            <ul className="space-y-1.5">
              <li><Link href="/terms" className="text-ink no-underline hover:underline">Terms</Link></li>
              <li><Link href="/privacy" className="text-ink no-underline hover:underline">Privacy</Link></li>
              <li><Link href="/guidelines" className="text-ink no-underline hover:underline">Guidelines</Link></li>
            </ul></nav>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="container-page py-4 text-xs text-muted">© {new Date().getFullYear()} Buna. Built for African founders.</p>
      </div>
    </footer>
  );
}
