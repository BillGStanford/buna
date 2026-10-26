export type CommentRow = {
  id: string;
  parent_id: string | null;
  body: string | null;
  status: "visible" | "hidden" | "deleted";
  author_id: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  edited_at: string | null;
};

export type CommentNode = CommentRow & { replies: CommentRow[] };

/**
 * Groups a flat, time-ordered comment list into top-level comments with their replies.
 * Replies are one level deep (enforced by the database). A reply whose parent is missing from the
 * list is promoted to top level rather than silently dropped.
 */
export function buildCommentTree(rows: CommentRow[]): CommentNode[] {
  const top = new Map<string, CommentNode>();
  const order: string[] = [];
  const orphans: CommentRow[] = [];
  for (const r of rows) {
    if (!r.parent_id) {
      top.set(r.id, { ...r, replies: [] });
      order.push(r.id);
    }
  }
  for (const r of rows) {
    if (!r.parent_id) continue;
    const parent = top.get(r.parent_id);
    if (parent) parent.replies.push(r);
    else orphans.push(r);
  }
  for (const o of orphans) {
    top.set(o.id, { ...o, parent_id: null, replies: [] });
    order.push(o.id);
  }
  return order.map((id) => top.get(id)!).filter(Boolean);
}

export function countVisible(nodes: CommentNode[]): number {
  return nodes.reduce((n, c) => n + (c.status === "visible" ? 1 : 0) + c.replies.filter((r) => r.status === "visible").length, 0);
}
