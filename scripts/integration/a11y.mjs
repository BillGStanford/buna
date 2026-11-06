// Accessibility scan: renders each page's HTML in jsdom and runs axe-core. Colour contrast can't be computed without a
// layout engine, so it is covered separately by src/lib/contrast.test.ts. LOCAL TESTING ONLY.
import { JSDOM, VirtualConsole } from "jsdom";
import axe from "axe-core";

const B = process.env.B;
const cookies = { owner: process.env.OWNER_COOKIE, mod: process.env.MOD_COOKIE, admin: process.env.ADMIN_COOKIE };
const OWN = "11111111-1111-4111-8111-111111111111";
const pages = [
  ["/", null], ["/community", null], ["/community/88888888-8888-4888-8888-888888888881", null], ["/startups", null], ["/startups/owner-works-co", null], ["/launches", null], ["/launches/owner-launch", null],
  ["/opportunities", null], ["/opportunities/real-grant", null], ["/founders", null], ["/founders/olivia", null], ["/investors", null], ["/investors/real-fund", null],
  ["/users/olivia", null], ["/about", null], ["/help", null], ["/contact", null], ["/privacy", null], ["/terms", null], ["/guidelines", null],
  ["/login", null], ["/signup", null], ["/forgot-password", null], ["/does-not-exist", null],
  ["/dashboard", "owner"], ["/dashboard/profile", "owner"], ["/dashboard/startup", "owner"], [`/dashboard/startup/${OWN}`, "owner"], [`/dashboard/startup/${OWN}/team`, "owner"],
  [`/dashboard/startup/${OWN}/verification`, "owner"], [`/dashboard/startup/${OWN}/analytics`, "owner"], ["/dashboard/launches", "owner"], ["/launches/submit", "owner"], ["/dashboard/inquiries", "owner"],
  ["/dashboard/notifications", "owner"], ["/dashboard/saved", "owner"], ["/dashboard/settings", "owner"], ["/dashboard/security", "owner"],
  ["/admin", "admin"], ["/admin/community", "admin"], ["/admin/reports", "admin"], ["/admin/startups", "admin"], ["/admin/launches", "admin"], ["/admin/opportunities", "admin"], ["/admin/users", "admin"],
  ["/admin/verification", "admin"], ["/admin/categories", "admin"], ["/admin/audit", "admin"], ["/admin/settings", "admin"], ["/admin/messages", "admin"],
];
let failures = 0, total = 0;
for (const [path, who] of pages) {
  const res = await fetch(B + path, { headers: who ? { Cookie: cookies[who] } : {}, redirect: "manual" });
  const html = await res.text();
  if (res.status >= 300 && res.status < 400) { console.log(`  skip ${path} (redirect ${res.status})`); continue; }
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
  dom.window.eval(axe.source);
  const result = await dom.window.axe.run(dom.window.document, { rules: { "color-contrast": { enabled: false }, "scrollable-region-focusable": { enabled: false } }, resultTypes: ["violations"] });
  const bad = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical" || v.impact === "moderate");
  total++;
  if (bad.length === 0) console.log(`  ok   a11y ${path}`);
  else {
    failures++;
    console.log(`  FAIL a11y ${path}`);
    for (const v of bad) console.log(`       [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.html.slice(0, 140)}`);
  }
}
console.log(`  scanned ${total} pages, ${failures} with violations`);
process.exit(failures ? 1 : 0);
