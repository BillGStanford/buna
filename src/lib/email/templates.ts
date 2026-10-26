/** HTML email building blocks. Every dynamic value MUST pass through escapeHtml. */

const BRAND = { primary: "#087F5B", deep: "#075B43", ink: "#172B24", muted: "#64746B", border: "#E1EAE4", mint: "#E7F7EF" };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailContent = {
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  footnote?: string;
};

export function renderEmail(content: EmailContent): { html: string; text: string } {
  const paragraphs = content.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND.ink}">${escapeHtml(p)}</p>`)
    .join("");
  const cta = content.cta && /^https?:\/\//i.test(content.cta.url)
    ? `<p style="margin:24px 0"><a href="${escapeHtml(content.cta.url)}" style="background:${BRAND.primary};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:8px;display:inline-block">${escapeHtml(content.cta.label)}</a></p>`
    : "";
  const footnote = content.footnote
    ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:${BRAND.muted}">${escapeHtml(content.footnote)}</p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#F3FBF6;padding:24px;font-family:Inter,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" style="max-width:560px;background:#ffffff;border:1px solid ${BRAND.border};border-radius:10px">
<tr><td style="padding:28px 32px">
<p style="margin:0 0 20px;font-size:18px;font-weight:700;color:${BRAND.deep}">Buna</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:${BRAND.ink}">${escapeHtml(content.heading)}</h1>
${paragraphs}${cta}${footnote}
</td></tr></table></td></tr></table></body></html>`;
  const text = [content.heading, "", ...content.paragraphs, content.cta ? `\n${content.cta.label}: ${content.cta.url}` : "", content.footnote ?? ""]
    .filter((l) => l !== undefined)
    .join("\n");
  return { html, text };
}
