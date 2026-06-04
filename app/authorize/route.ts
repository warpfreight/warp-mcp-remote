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
<body style="margin:0;background:#141c2b;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box">
  <div style="width:100%;max-width:380px;background:#1c2536;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:32px;box-shadow:0 10px 36px rgba(0,0,0,.3)">
    <svg width="116" height="33" viewBox="0 0 660 186" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Warp" style="display:block;margin:0 auto 22px">
      <path d="M660 185.035H0V0H660V185.035ZM14.0597 171.327H646.141V13.9593H14.0597V171.327Z" fill="#00FF33"/>
      <path d="M300.976 53.2756L332.509 131.608H351.239L319.705 53.2756H300.976Z" fill="#00FF33"/>
      <path d="M215.919 131.608H234.648L266.182 53.2756H247.453L215.919 131.608Z" fill="#00FF33"/>
      <path d="M150.892 107.405L136.431 71.3523H115.593L101.131 107.405L78.2342 53.2756H60.0068L93.047 131.608H109.517L125.987 90.5839L142.457 131.608H158.927L192.017 53.2756H173.739L150.892 107.405Z" fill="#00FF33"/>
      <path d="M471.856 82.8511C471.816 75.0646 468.691 67.6113 463.166 62.1242C457.642 56.6371 450.167 53.5636 442.381 53.5769H388.502V131.608H405.323V112.125H440.021L447.854 131.608H465.981L456.691 108.41C461.258 105.886 465.065 102.183 467.715 97.6881C470.364 93.1928 471.759 88.0691 471.755 82.8511H471.856ZM405.323 70.3481H442.381C445.71 70.3481 448.903 71.6706 451.257 74.0248C453.611 76.379 454.934 79.572 454.934 82.9013C454.934 86.2307 453.611 89.4236 451.257 91.7778C448.903 94.132 445.71 95.4546 442.381 95.4546H405.323V70.3481Z" fill="#00FF33"/>
      <path d="M570.768 53.5769H516.939V131.608H533.711V112.125H570.768C574.612 112.125 578.419 111.368 581.971 109.897C585.522 108.426 588.749 106.269 591.468 103.551C594.186 100.833 596.342 97.6055 597.814 94.0538C599.285 90.5021 600.042 86.6954 600.042 82.8511C600.042 79.0067 599.285 75.2 597.814 71.6483C596.342 68.0966 594.186 64.8695 591.468 62.1511C588.749 59.4327 585.522 57.2764 581.971 55.8053C578.419 54.3341 574.612 53.5769 570.768 53.5769ZM570.768 95.4043H533.711V70.2978H570.768C574.097 70.2978 577.29 71.6204 579.644 73.9746C581.998 76.3288 583.321 79.5217 583.321 82.8511C583.321 86.1804 581.998 89.3734 579.644 91.7276C577.29 94.0818 574.097 95.4043 570.768 95.4043Z" fill="#00FF33"/>
      <path d="M292.04 76.1794H275.219V94.1557H292.04V76.1794Z" fill="#00FF33"/>
      <path d="M275.219 131.615H292.04V113.84H275.219V131.615Z" fill="#00FF33"/>
    </svg>
    <h1 style="font-size:21px;font-weight:700;letter-spacing:-.01em;margin:0 0 8px;text-align:center">Sign in to connect</h1>
    <p style="font-size:13.5px;color:#94a3b8;line-height:1.6;margin:0 0 24px;text-align:center">Log in with your Warp account so this assistant can quote, book, and track your freight. Your password is sent only to Warp — never to the assistant.</p>
    ${errorMsg ? `<div style="background:rgba(229,72,77,.12);border:1px solid rgba(229,72,77,.4);color:#f8a8aa;border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:14px">${esc(errorMsg)}</div>` : ""}
    <form method="POST" action="/authorize">
      ${hidden}
      <label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px">Email</label>
      <input name="email" type="email" required autofocus style="width:100%;box-sizing:border-box;background:#141c2b;border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#e2e8f0;padding:10px 12px;font-size:14px;margin-bottom:14px">
      <label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px">Password</label>
      <input name="password" type="password" required style="width:100%;box-sizing:border-box;background:#141c2b;border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#e2e8f0;padding:10px 12px;font-size:14px;margin-bottom:20px">
      <button type="submit" style="width:100%;background:#00FA8A;color:#07120D;border:none;border-radius:8px;height:44px;font-size:14px;font-weight:700;cursor:pointer">Sign in</button>
    </form>
    <p style="font-size:12.5px;color:#94a3b8;line-height:1.55;text-align:center;margin:18px 0 0">
      Don't have a Warp account?<br>
      <a href="https://www.wearewarp.com/agents/account" target="_blank" rel="noopener noreferrer" style="color:#00FA8A;font-weight:600;text-decoration:none">Create one at wearewarp.com/agents/account &rarr;</a>
    </p>
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

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const r = await loginAndGetKey(email, password, ip);
  if (!r.ok) return page(p, r.error);

  const code = seal<AuthCode>({ t: "code", key: r.key, cc: p.code_challenge, ru: p.redirect_uri, ci: p.client_id, exp: now() + CODE_TTL });
  const dest = new URL(p.redirect_uri);
  dest.searchParams.set("code", code);
  if (p.state) dest.searchParams.set("state", p.state);
  return Response.redirect(dest.toString(), 302);
}
