import { unseal, seal, now, CODE_TTL, type ClientToken, type AuthCode } from "@/lib/oauth";
import { loginAndGetKey } from "@/lib/warpAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type P = {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string;
};

const FIELDS: (keyof P)[] = ["response_type", "client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method", "scope"];

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c] ?? c);

function readParams(src: URLSearchParams | FormData): P {
  const g = (k: string) => String(src.get(k) ?? "");
  return { response_type: g("response_type"), client_id: g("client_id"), redirect_uri: g("redirect_uri"), state: g("state"), code_challenge: g("code_challenge"), code_challenge_method: g("code_challenge_method"), scope: g("scope") };
}

function validate(p: P): { ok: boolean; error?: string } {
  if (p.response_type !== "code") return { ok: false, error: "response_type must be 'code'" };
  if (!p.code_challenge) return { ok: false, error: "PKCE code_challenge is required" };
  if (p.code_challenge_method !== "S256") return { ok: false, error: "code_challenge_method must be S256" };
  const client = unseal<ClientToken>(p.client_id);
  if (!client || client.t !== "client") return { ok: false, error: "invalid client_id" };
  if (!client.redirect_uris.includes(p.redirect_uri)) return { ok: false, error: "redirect_uri not registered for this client" };
  return { ok: true };
}

function page(p: P, errorMsg?: string): Response {
  const hidden = FIELDS.map((f) => `<input type="hidden" name="${f}" value="${esc(p[f])}">`).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign in to Warp</title></head>
<body style="margin:0;background:#141c2b;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center">
  <div style="width:360px;max-width:90vw;background:#1c2536;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:28px">
    <div style="font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#64748b;font-weight:600">Warp</div>
    <h1 style="font-size:22px;font-weight:700;margin:8px 0 4px">Sign in to connect</h1>
    <p style="font-size:13.5px;color:#94a3b8;line-height:1.5;margin:0 0 20px">Log in with your Warp account to let this AI assistant quote, book, and track your freight. Your password is sent only to Warp — the assistant never sees it.</p>
    ${errorMsg ? `<div style="background:rgba(229,72,77,.12);border:1px solid rgba(229,72,77,.4);color:#f8a8aa;border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:14px">${esc(errorMsg)}</div>` : ""}
    <form method="POST" action="/authorize">
      ${hidden}
      <label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px">Email</label>
      <input name="email" type="email" required autofocus style="width:100%;box-sizing:border-box;background:#141c2b;border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#e2e8f0;padding:10px 12px;font-size:14px;margin-bottom:14px">
      <label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px">Password</label>
      <input name="password" type="password" required style="width:100%;box-sizing:border-box;background:#141c2b;border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#e2e8f0;padding:10px 12px;font-size:14px;margin-bottom:20px">
      <button type="submit" style="width:100%;background:#00FA8A;color:#07120D;border:none;border-radius:8px;height:44px;font-size:14px;font-weight:700;cursor:pointer">Sign in</button>
    </form>
  </div>
</body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: Request) {
  const p = readParams(new URL(req.url).searchParams);
  const v = validate(p);
  if (!v.ok) return new Response(`Invalid authorization request: ${v.error}`, { status: 400 });
  return page(p);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const p = readParams(form);
  const v = validate(p);
  if (!v.ok) return new Response(`Invalid authorization request: ${v.error}`, { status: 400 });

  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return page(p, "Enter your email and password.");

  const r = await loginAndGetKey(email, password);
  if (!r.ok) return page(p, r.error);

  const code = seal<AuthCode>({ t: "code", key: r.key, cc: p.code_challenge, ru: p.redirect_uri, ci: p.client_id, exp: now() + CODE_TTL });
  const dest = new URL(p.redirect_uri);
  dest.searchParams.set("code", code);
  if (p.state) dest.searchParams.set("state", p.state);
  return Response.redirect(dest.toString(), 302);
}
