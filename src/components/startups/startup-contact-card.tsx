"use client";

import * as React from "react";
import { MessageSquareText, X } from "lucide-react";
import { InquiryForm } from "@/components/people/inquiry-form";
import { buttonStyles } from "@/components/ui/button";

export function StartupContactCard({ startupId, startupName, defaultName, defaultEmail }: {
  startupId: string;
  startupName: string;
  defaultName?: string;
  defaultEmail?: string;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  return (
    <>
      <section id="contact" className="rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(23,43,36,0.04)] scroll-mt-24">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-mint text-primary-deep"><MessageSquareText className="h-5 w-5" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Contact the team</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">Have a question, partnership idea, or investment inquiry? Send the team a private message.</p>
            <button type="button" className={buttonStyles("primary", "md") + " mt-3"} onClick={() => dialogRef.current?.showModal()}>
              Contact team
            </button>
          </div>
        </div>
      </section>
      <dialog ref={dialogRef} aria-labelledby="startup-contact-title" onClose={() => {}} className="m-auto max-h-[88vh] w-[min(92vw,42rem)] overflow-y-auto rounded-xl border border-line bg-canvas p-0 text-ink shadow-2xl backdrop:bg-ink/50">
        <div className="flex items-center justify-between border-b border-line bg-primary-pale/40 px-5 py-4">
          <div><h2 id="startup-contact-title" className="font-semibold">Message {startupName}</h2><p className="mt-1 text-xs text-muted">Your contact details are shared only with this startup team.</p></div>
          <button type="button" aria-label="Close contact form" onClick={() => dialogRef.current?.close()} className="rounded-md p-2 text-muted hover:bg-surface hover:text-ink"><X className="h-5 w-5" aria-hidden="true"/></button>
        </div>
        <div className="p-5"><InquiryForm startupId={startupId} startupName={startupName} defaultName={defaultName} defaultEmail={defaultEmail}/></div>
      </dialog>
    </>
  );
}
