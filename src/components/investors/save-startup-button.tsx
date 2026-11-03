import { saveStartupForInvestorAction } from "@/app/dashboard/investor/actions";
import { buttonStyles } from "@/components/ui/button";

export function SaveStartupForInvestorButton({ startupId, saved }: { startupId: string; saved: boolean }) {
  return <form action={saveStartupForInvestorAction}>
    <input type="hidden" name="startupId" value={startupId} />
    <button type="submit" className={buttonStyles("secondary", "sm")}>{saved ? "Remove from saved startups" : "Save to investor list"}</button>
  </form>;
}
