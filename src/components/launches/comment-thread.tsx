"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { createCommentAction, deleteCommentAction, editCommentAction } from "@/app/launches/actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/fields";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { FormMessage, firstError, valueOf } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { ReportDialog } from "@/components/startups/report-dialog";
import { formatDate } from "@/lib/format";
import { idleState } from "@/lib/types";
import type { CommentNode, CommentRow } from "@/lib/launches/comments";

function CommentForm({ launchId, parentId, label, onDone, autoFocus }: { launchId: string; parentId?: string; label: string; onDone?: () => void; autoFocus?: boolean }) {
  const [state, action] = useActionState(createCommentAction, idleState);
  const [nonce, setNonce] = React.useState(0);
  React.useEffect(() => {
    if (state.status === "success") { setNonce((n) => n + 1); onDone?.(); }
  }, [state, onDone]);
  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="launchId" value={launchId} />
      <input type="hidden" name="parentId" value={parentId ?? ""} />
      {state.status === "error" ? <FormMessage state={state} /> : null}
      <TextAreaField key={nonce} label={label} name="body" rows={parentId ? 3 : 4} maxLength={2000} autoFocus={autoFocus}
        defaultValue={state.status === "error" ? valueOf(state, "body") : ""} error={firstError(state, "body")} />
      <SubmitButton size="sm" pendingLabel="Posting…">{parentId ? "Post reply" : "Post comment"}</SubmitButton>
    </form>
  );
}

function EditForm({ comment, onDone }: { comment: CommentRow; onDone: () => void }) {
  const [state, action] = useActionState(editCommentAction, idleState);
  React.useEffect(() => { if (state.status === "success") onDone(); }, [state, onDone]);
  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="commentId" value={comment.id} />
      {state.status === "error" ? <FormMessage state={state} /> : null}
      <TextAreaField label="Edit your comment" name="body" rows={3} maxLength={2000} defaultValue={comment.body ?? ""} error={firstError(state, "body")} />
      <div className="flex gap-2"><SubmitButton size="sm" pendingLabel="Saving…">Save</SubmitButton><Button variant="ghost" size="sm" onClick={onDone}>Cancel</Button></div>
    </form>
  );
}

/** Disclosure that keeps its content in the HTML (works without JavaScript) and closes itself when the action succeeds. */
function Disclosure({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const ref = React.useRef<HTMLDetailsElement>(null);
  const close = React.useCallback(() => { if (ref.current) ref.current.open = false; }, []);
  return (
    <details ref={ref} className="group w-full">
      <summary className="inline-flex cursor-pointer list-none items-center rounded-md px-3 py-1.5 text-sm font-semibold text-ink hover:bg-primary-mint [&::-webkit-details-marker]:hidden">{label}</summary>
      <div className="pt-2">{children(close)}</div>
    </details>
  );
}

function CommentView({ comment, launchId, viewerId, canComment, signedIn, loginHref, isReply, topId }: {
  comment: CommentRow; launchId: string; viewerId: string | null; canComment: boolean; signedIn: boolean; loginHref: string; isReply: boolean; topId: string;
}) {

  if (comment.status !== "visible") {
    return <p id={`comment-${comment.id}`} className="text-sm italic text-muted">This comment was removed.</p>;
  }
  const mine = viewerId !== null && comment.author_id === viewerId;
  return (
    <div id={`comment-${comment.id}`} className="flex gap-3 scroll-mt-24">
      <Avatar name={comment.display_name} src={comment.avatar_url} size={isReply ? 28 : 36} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm">
          {comment.username ? <Link href={`/users/${comment.username}`} className="font-semibold text-ink no-underline hover:underline">{comment.display_name || `@${comment.username}`}</Link> : <span className="font-semibold">Member</span>}
          <span className="text-muted"> · <time dateTime={comment.created_at}>{formatDate(comment.created_at)}</time>{comment.edited_at ? " · edited" : ""}</span>
        </p>
        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{comment.body}</p>
        <div className="flex flex-wrap items-start gap-1 text-sm">
          {mine ? (
            <>
              <div className="w-auto"><Disclosure label="Edit">{(close) => <EditForm comment={comment} onDone={close} />}</Disclosure></div>
              <ConfirmActionForm action={deleteCommentAction} fields={{ commentId: comment.id }} trigger="Delete" title="Delete this comment?"
                description="It will be removed from the discussion. Replies to it stay." confirmLabel="Delete comment" />
            </>
          ) : (
            <ReportDialog targetType="comment" targetId={comment.id} targetName="this comment" signedIn={signedIn} loginHref={loginHref} compact />
          )}
        </div>
        {!isReply && canComment ? <Disclosure label="Reply">{(close) => <CommentForm launchId={launchId} parentId={topId} label="Your reply" onDone={close} />}</Disclosure> : null}
      </div>
    </div>
  );
}

export function CommentThread({ launchId, comments, viewerId, canComment, loginHref }: {
  launchId: string; comments: CommentNode[]; viewerId: string | null; canComment: boolean; loginHref: string;
}) {
  const signedIn = viewerId !== null;
  return (
    <div className="space-y-6">
      {canComment ? (
        signedIn ? <CommentForm launchId={launchId} label="Add to the discussion" /> : (
          <p className="rounded-md border border-line bg-primary-pale p-4 text-sm"><Link href={loginHref} className="font-medium">Sign in</Link> to join the discussion.</p>
        )
      ) : null}
      {comments.length === 0 ? (
        <p className="text-sm text-muted">{canComment ? "No comments yet. Start the conversation." : "No comments."}</p>
      ) : (
        <ul className="space-y-6">
          {comments.map((c) => (
            <li key={c.id} className="space-y-4">
              <CommentView comment={c} launchId={launchId} viewerId={viewerId} canComment={canComment} signedIn={signedIn} loginHref={loginHref} isReply={false} topId={c.id} />
              {c.replies.length > 0 ? (
                <ul className="ml-4 space-y-4 border-l border-line pl-4 sm:ml-12">
                  {c.replies.map((r) => (
                    <li key={r.id}><CommentView comment={r} launchId={launchId} viewerId={viewerId} canComment={canComment} signedIn={signedIn} loginHref={loginHref} isReply topId={c.id} /></li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
