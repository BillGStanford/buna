import { describe, expect, it } from "vitest";
import { buildCommentTree, countVisible, type CommentRow } from "./comments";

const row = (id: string, parent: string | null, status: CommentRow["status"] = "visible"): CommentRow => ({
  id, parent_id: parent, body: status === "visible" ? id : null, status, author_id: "u", username: "u", display_name: "U", avatar_url: null,
  created_at: "2026-10-19T00:00:00Z", edited_at: null,
});

describe("buildCommentTree", () => {
  it("nests replies under their parent and preserves order", () => {
    const t = buildCommentTree([row("a", null), row("b", null), row("a1", "a"), row("b1", "b"), row("a2", "a")]);
    expect(t.map((c) => c.id)).toEqual(["a", "b"]);
    expect(t[0]?.replies.map((r) => r.id)).toEqual(["a1", "a2"]);
    expect(t[1]?.replies.map((r) => r.id)).toEqual(["b1"]);
  });
  it("keeps removed parents as placeholders with their replies", () => {
    const t = buildCommentTree([row("a", null, "deleted"), row("a1", "a")]);
    expect(t[0]?.status).toBe("deleted");
    expect(t[0]?.replies.length).toBe(1);
  });
  it("promotes orphaned replies instead of dropping them", () => {
    const t = buildCommentTree([row("x1", "missing")]);
    expect(t.map((c) => c.id)).toEqual(["x1"]);
    expect(t[0]?.parent_id).toBeNull();
  });
  it("counts visible comments only", () => {
    expect(countVisible(buildCommentTree([row("a", null, "deleted"), row("a1", "a"), row("b", null)]))).toBe(2);
  });
  it("handles empty input", () => expect(buildCommentTree([])).toEqual([]));
});
