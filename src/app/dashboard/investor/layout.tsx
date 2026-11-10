import type { Metadata } from "next";
import { InvestorDeskNavigation } from "@/components/investors/investor-desk-navigation";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function InvestorDeskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-5">
      <InvestorDeskNavigation />
      {children}
    </div>
  );
}
