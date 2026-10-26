import { describe, expect, it } from "vitest";
import { escapeHtml, renderEmail } from "./templates";

describe("email templates", () => {
  it("escapes html in every dynamic field", () => {
    const { html } = renderEmail({
      heading: "<script>alert(1)</script>",
      paragraphs: ['Hi <img src=x onerror="bad()">'],
      cta: { label: "Open", url: "https://example.com/?a=1&b=2" },
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a=1&amp;b=2");
  });
  it("drops non-http call-to-action links", () => {
    const { html } = renderEmail({ heading: "x", paragraphs: [], cta: { label: "Click", url: "javascript:alert(1)" } });
    expect(html).not.toContain("javascript:");
  });
  it("escapeHtml handles quotes", () => {
    expect(escapeHtml(`"'&<>`)).toBe("&quot;&#39;&amp;&lt;&gt;");
  });
});
