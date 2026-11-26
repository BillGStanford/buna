import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { submitSupportTicketAction, submitUserDisputeAction } from "./actions";

export const metadata:Metadata={title:"Support & appeals",robots:{index:false}};
const input="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm";
const area="mt-1 min-h-28 w-full rounded-md border border-line bg-surface p-3 text-sm";
export default async function SupportPage(){
 const user=await requireUser("/support");
 return <main className="container-page max-w-3xl space-y-8 py-10">
  <header><h1 className="text-3xl font-bold">Support & appeals</h1><p className="mt-2 text-sm text-muted">Contact Buna's team or formally dispute a moderation or account decision. Your submissions are private to authorized staff.</p></header>
  <section className="rounded-xl border border-line p-5"><h2 className="text-xl font-semibold">Contact support</h2><form action={submitSupportTicketAction} className="mt-4 space-y-3"><label className="block text-sm">Subject<input name="subject" required minLength={3} maxLength={180} className={input}/></label><label className="block text-sm">Priority<select name="priority" className={input}><option value="normal">Normal</option><option value="high">High</option></select></label><label className="block text-sm">How can we help?<textarea name="body" required minLength={5} maxLength={8000} className={area}/></label><p className="text-xs text-muted">Reply contact: {user.email??"your account email"}</p><button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">Submit ticket</button></form></section>
  <section className="rounded-xl border border-line p-5"><h2 className="text-xl font-semibold">Dispute a decision</h2><p className="mt-1 text-sm text-muted">Explain which action you are disputing and why it should be reconsidered.</p><form action={submitUserDisputeAction} className="mt-4 space-y-3"><label className="block text-sm">Decision or action being disputed<input name="disputed_action" required minLength={2} maxLength={120} placeholder="e.g. startup listing rejection" className={input}/></label><label className="block text-sm">Subject<input name="subject" required minLength={3} maxLength={180} className={input}/></label><label className="block text-sm">Your explanation<textarea name="details" required minLength={5} maxLength={8000} className={area}/></label><button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">Submit dispute</button></form></section>
 </main>;
}
