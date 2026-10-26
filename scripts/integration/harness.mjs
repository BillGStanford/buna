// Local integration harness (no Supabase account needed).
//   node harness.mjs token <role> [sub]   → prints an HS256 JWT signed with the test secret
//   node harness.mjs cookie <sub> <email> → prints a Supabase SSR auth cookie "name=value"
//   node harness.mjs proxy                → Supabase-shaped gateway: /rest/v1 → PostgREST, /auth/v1/user → fake
// The fake auth endpoint only validates tokens signed with the test secret. LOCAL TESTING ONLY.
import crypto from "node:crypto";
import http from "node:http";
import { execFile } from "node:child_process";

export const SECRET = process.env.JWT_SECRET ?? "local-integration-secret-0123456789-abcdef";
const b64u = (b) => Buffer.from(b).toString("base64url");

export function sign(payload) {
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

export function verify(token) {
  const [h, b, s] = (token ?? "").split(".");
  if (!h || !b || !s) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(`${h}.${b}`).digest("base64url");
  if (expected !== s) return null;
  return JSON.parse(Buffer.from(b, "base64url").toString());
}

const now = () => Math.floor(Date.now() / 1000);
export const roleToken = (role, sub) => sign({ role, ...(sub ? { sub } : {}), iss: "local", iat: now(), exp: now() + 86400 * 365 });

export function authCookie(sub, email, port = 3002) {
  const user = { id: sub, aud: "authenticated", role: "authenticated", email, email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  const session = { access_token: roleToken("authenticated", sub), token_type: "bearer", expires_in: 86400, expires_at: now() + 86400, refresh_token: "local-refresh", user };
  return `sb-localhost-auth-token=base64-${b64u(JSON.stringify(session))}`;
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === "token") console.log(roleToken(a, b));
else if (cmd === "cookie") console.log(authCookie(a, b));
else if (cmd === "proxy") {
  const target = Number(process.env.POSTGREST_PORT ?? 3001);
  const emails = JSON.parse(process.env.USER_EMAILS ?? "{}");
  http.createServer((req, res) => {
    const url = req.url ?? "/";
    if (url.startsWith("/auth/v1/user")) {
      const claims = verify((req.headers.authorization ?? "").replace(/^Bearer /, ""));
      if (!claims?.sub) { res.writeHead(401, { "content-type": "application/json" }); return res.end(JSON.stringify({ message: "invalid token" })); }
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ id: claims.sub, aud: "authenticated", role: "authenticated", email: emails[claims.sub] ?? "user@test.dev", email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" }));
    }
    if (url.startsWith("/auth/v1/token") && req.method === "POST") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const { email, password } = JSON.parse(body || "{}");
        const id = Object.keys(emails).find((k) => emails[k] === email);
        if (!id || password !== "correct-horse-1") { res.writeHead(400, { "content-type": "application/json" }); return res.end(JSON.stringify({ code: "invalid_credentials", error_code: "invalid_credentials", msg: "Invalid login credentials" })); }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ access_token: roleToken("authenticated", id), token_type: "bearer", expires_in: 3600, expires_at: now() + 3600, refresh_token: "x", user: { id, email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } }));
      });
      return;
    }
    if (url.startsWith("/auth/v1/logout")) { res.writeHead(204); return res.end(); }
    const adminDelete = url.match(/^\/auth\/v1\/admin\/users\/([0-9a-f-]{36})/);
    if (adminDelete && req.method === "DELETE") {
      const claims = verify((req.headers.authorization ?? "").replace(/^Bearer /, ""));
      if (claims?.role !== "service_role") { res.writeHead(403, { "content-type": "application/json" }); return res.end("{}"); }
      return execFile(process.env.PSQL_BIN ?? "psql", ["-d", process.env.PROXY_DB ?? "buna_it", "-c", `delete from auth.users where id = '${adminDelete[1]}'`], (err) => {
        res.writeHead(err ? 500 : 200, { "content-type": "application/json" }); res.end(err ? JSON.stringify({ msg: String(err) }) : "{}");
      });
    }
    if (!url.startsWith("/rest/v1/")) { res.writeHead(404); return res.end("not found"); }
    const proxied = http.request({ host: "127.0.0.1", port: target, method: req.method, path: url.slice("/rest/v1".length), headers: { ...req.headers, host: `127.0.0.1:${target}` } }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers); r.pipe(res);
    });
    proxied.on("error", () => { res.writeHead(502); res.end("postgrest unavailable"); });
    req.pipe(proxied);
  }).listen(Number(process.env.PROXY_PORT ?? 3002), () => console.log("proxy up"));
}
