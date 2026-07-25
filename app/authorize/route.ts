import { unseal, seal, now, CODE_TTL, randomId, type ClientToken, type AuthCode } from "@/lib/oauth";
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
  // Show the user *where* the token will go + give them an explicit Deny path.
  // redirect_uri is already validated against the registered client before page() runs.
  let dest = p.redirect_uri;
  let deny = "";
  try {
    const u = new URL(p.redirect_uri);
    dest = u.host;
    u.searchParams.set("error", "access_denied");
    if (p.state) u.searchParams.set("state", p.state);
    deny = u.toString();
  } catch { /* invalid redirect_uri — already rejected by validate() */ }

  // Design notes:
  // - Palette is warp-site's own tokens (globals.css): mint --warp-accent #4ade80
  //   (+ #86efac bright, #22c55e deep) over the bluish ink family #0e1622 /
  //   #131c2a / #1a2332, borders #253040, info blue #38bdf8. The old page used
  //   #00FA8A, which matches nothing on the site. The wordmark keeps the
  //   canonical logo green #00FF33 (logo-only per the site's brand guard).
  // - The backdrop is a retro-dither field: Bayer 4x4 ordered dithering,
  //   4-level quantization, chunky pixels, and a soft lens that follows the
  //   pointer (radius 0.5 of the minor dimension, softness 1, followSpeed 3 —
  //   the RetroDither parameter model). Implemented as a ~90-line inline
  //   canvas renderer because the reference component requires Chrome's
  //   experimental HTML-in-canvas API, which no stable browser exposes — its
  //   own support probe falls back to "no effect" for essentially every real
  //   user of this page. Same math, portable delivery.
  // - The form is plain HTML and works with JS disabled; the canvas is
  //   decorative (aria-hidden) over a CSS gradient fallback. The first frame
  //   renders SYNCHRONOUSLY so hidden/background documents (where browsers
  //   never service requestAnimationFrame) still paint the settled field.
  // - prefers-reduced-motion: static frame, no loop, no lens.
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Sign in to Warp</title>
<style>
  :root{
    --ink:#0e1622; --ink-2:#131c2a; --ink-3:#1a2332;
    --border:#253040; --border-strong:#334155;
    --text:#f0f2f5; --muted:#b0b8c4; --dim:#7a8494;
    --mint:#4ade80; --mint-bright:#86efac; --mint-deep:#22c55e;
    --info:#38bdf8; --danger:#ef4444; --logo:#00FF33;
  }
  *{box-sizing:border-box}
  html,body{margin:0;min-height:100vh}
  body{
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    color:var(--text);
    background:radial-gradient(120% 90% at 80% -10%,#16283a 0%,var(--ink) 55%,#0a111b 100%);
    display:flex;align-items:center;justify-content:center;padding:24px;
  }
  #dither{position:fixed;inset:0;width:100vw;height:100vh;z-index:0;pointer-events:none}
  .card{
    position:relative;z-index:1;width:100%;max-width:400px;
    background:color-mix(in srgb,var(--ink-2) 88%,transparent);
    border:1px solid var(--border);border-radius:18px;padding:34px 30px 28px;
    box-shadow:0 1px 0 rgba(255,255,255,.04) inset,0 24px 70px -30px rgba(0,0,0,.85);
    backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  }
  .logo{display:block;margin:0 auto 24px;height:32px;width:auto}
  h1{font-size:20px;font-weight:700;letter-spacing:-.01em;margin:0 0 6px;text-align:center}
  .sub{font-size:13px;color:var(--muted);line-height:1.6;margin:0 0 18px;text-align:center}
  .chip{
    display:flex;align-items:center;justify-content:center;gap:7px;
    background:var(--ink);border:1px solid var(--border);border-radius:10px;
    padding:9px 12px;margin:0 0 20px;font-size:12.5px;
  }
  .chip .dot{width:6px;height:6px;border-radius:99px;background:var(--info);flex:0 0 auto}
  .chip span{color:var(--dim)} .chip strong{color:var(--text);word-break:break-all;font-weight:600}
  .err{
    background:color-mix(in srgb,var(--danger) 12%,transparent);
    border:1px solid color-mix(in srgb,var(--danger) 42%,transparent);
    color:#fca5a5;border-radius:10px;padding:10px 12px;font-size:13px;margin:0 0 14px;line-height:1.5;
  }
  label{display:block;font-size:12px;font-weight:600;letter-spacing:.02em;color:var(--dim);margin:0 0 6px;text-transform:uppercase}
  input[type=email],input[type=password]{
    width:100%;background:var(--ink);border:1px solid var(--border);border-radius:10px;
    color:var(--text);padding:11px 13px;font-size:14px;margin-bottom:16px;outline:none;
    transition:border-color .15s,box-shadow .15s;
  }
  input:focus{border-color:var(--mint);box-shadow:0 0 0 3px color-mix(in srgb,var(--mint) 22%,transparent)}
  button{
    width:100%;background:var(--mint);color:#0b1613;border:none;border-radius:10px;height:46px;
    font-size:14.5px;font-weight:700;letter-spacing:.01em;cursor:pointer;margin-top:4px;
    transition:background .15s,transform .06s;
  }
  button:hover{background:var(--mint-bright)} button:active{transform:translateY(1px)}
  .cancel{display:block;text-align:center;margin-top:14px;font-size:13px;color:var(--dim);text-decoration:none}
  .cancel:hover{color:var(--muted)}
  .foot{font-size:12.5px;color:var(--dim);line-height:1.6;text-align:center;margin:20px 0 0}
  .foot a{color:var(--mint);font-weight:600;text-decoration:none}
  .foot a:hover{color:var(--mint-bright)}
  .fine{font-size:11.5px;color:var(--dim);line-height:1.55;text-align:center;margin:14px 0 0;padding-top:14px;border-top:1px solid var(--border)}
</style></head>
<body>
  <canvas id="dither" aria-hidden="true"></canvas>
  <main class="card">
    <svg class="logo" viewBox="0 0 660 186" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Warp">
      <path d="M660 185.035H0V0H660V185.035ZM14.0597 171.327H646.141V13.9593H14.0597V171.327Z" fill="#00FF33"/>
      <path d="M300.976 53.2756L332.509 131.608H351.239L319.705 53.2756H300.976Z" fill="#00FF33"/>
      <path d="M215.919 131.608H234.648L266.182 53.2756H247.453L215.919 131.608Z" fill="#00FF33"/>
      <path d="M150.892 107.405L136.431 71.3523H115.593L101.131 107.405L78.2342 53.2756H60.0068L93.047 131.608H109.517L125.987 90.5839L142.457 131.608H158.927L192.017 53.2756H173.739L150.892 107.405Z" fill="#00FF33"/>
      <path d="M471.856 82.8511C471.816 75.0646 468.691 67.6113 463.166 62.1242C457.642 56.6371 450.167 53.5636 442.381 53.5769H388.502V131.608H405.323V112.125H440.021L447.854 131.608H465.981L456.691 108.41C461.258 105.886 465.065 102.183 467.715 97.6881C470.364 93.1928 471.759 88.0691 471.755 82.8511H471.856ZM405.323 70.3481H442.381C445.71 70.3481 448.903 71.6706 451.257 74.0248C453.611 76.379 454.934 79.572 454.934 82.9013C454.934 86.2307 453.611 89.4236 451.257 91.7778C448.903 94.132 445.71 95.4546 442.381 95.4546H405.323V70.3481Z" fill="#00FF33"/>
      <path d="M570.768 53.5769H516.939V131.608H533.711V112.125H570.768C574.612 112.125 578.419 111.368 581.971 109.897C585.522 108.426 588.749 106.269 591.468 103.551C594.186 100.833 596.342 97.6055 597.814 94.0538C599.285 90.5021 600.042 86.6954 600.042 82.8511C600.042 79.0067 599.285 75.2 597.814 71.6483C596.342 68.0966 594.186 64.8695 591.468 62.1511C588.749 59.4327 585.522 57.2764 581.971 55.8053C578.419 54.3341 574.612 53.5769 570.768 53.5769ZM570.768 95.4043H533.711V70.2978H570.768C574.097 70.2978 577.29 71.6204 579.644 73.9746C581.998 76.3288 583.321 79.5217 583.321 82.8511C583.321 86.1804 581.998 89.3734 579.644 91.7276C577.29 94.0818 574.097 95.4043 570.768 95.4043Z" fill="#00FF33"/>
      <path d="M292.04 76.1794H275.219V94.1557H292.04V76.1794Z" fill="#00FF33"/>
      <path d="M275.219 131.615H292.04V113.84H275.219V131.615Z" fill="#00FF33"/>
    </svg>
    <h1>Sign in to Warp</h1>
    <p class="sub">Connect your Warp account so this assistant can quote, book, and track freight on your behalf.</p>
    <div class="chip"><span class="dot"></span><span>Authorizing</span><strong>${esc(dest)}</strong></div>
    ${errorMsg ? `<div class="err">${esc(errorMsg)}</div>` : ""}
    <form method="POST" action="/authorize">
      ${hidden}
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="email" required autofocus>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <button type="submit">Sign in &amp; authorize</button>
    </form>
    ${deny ? `<a class="cancel" href="${esc(deny)}">Cancel and return</a>` : ""}
    <p class="foot">New to Warp? <a href="https://www.wearewarp.com/agents/account" target="_blank" rel="noopener noreferrer">Create an account &rarr;</a></p>
    <p class="fine">Your password goes only to Warp — never to the assistant. Booking through the assistant charges the card on file with your Warp account.</p>
  </main>
  <script>
  (function () {
    "use strict";
    var cv = document.getElementById("dither");
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext("2d");
    if (!ctx) return;

    // RetroDither parameter model (same names, same defaults where they apply):
    var PIXEL = 3;          // pixelSize
    var LEVELS = 4;         // levels
    var RADIUS = 0.5;       // radius, relative to the minor dimension
    var SOFTNESS = 1;       // edge feather
    var STRENGTH = 0.8;     // coverage inside the lens
    var BASE = 0.14;        // ambient coverage outside the lens
    var FOLLOW = 3;         // followSpeed
    // Palette: bluish ink -> mint (warp-site tokens), with a faint info-blue blob.
    var DARK = [10, 17, 27];        // #0a111b
    var MINT = [74, 222, 128];      // #4ade80
    var BLUE = [56, 189, 248];      // #38bdf8

    // Bayer 4x4 (identical table to the reference shader).
    var B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

    var W = 0, H = 0, CW = 0, CH = 0, img = null, off = null, octx = null;
    function size() {
      W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
      CW = Math.ceil(W / PIXEL); CH = Math.ceil(H / PIXEL);
      cv.width = W; cv.height = H;
      off = document.createElement("canvas"); off.width = CW; off.height = CH;
      octx = off.getContext("2d");
      img = octx ? octx.createImageData(CW, CH) : null;
    }
    size();

    var px = 0.72, py = 0.3, tx = px, ty = py, act = 0, tact = 0, lastMove = 0;
    var reduce = false;
    try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

    function frame(t) {
      if (!img || !octx) return;
      var d = img.data;
      var aspect = W / H;
      var minorR = RADIUS * (aspect > 1 ? 1 : aspect);
      var inner = minorR * (1 - SOFTNESS);
      var i = 0;
      for (var y = 0; y < CH; y++) {
        var v = y / CH;
        for (var x = 0; x < CW; x++) {
          var u = x / CW;
          // Procedural scene: diagonal ink ramp + drifting mint blob + faint blue blob.
          var drift = t * 0.00004;
          var mintD = Math.hypot((u - (0.78 + Math.sin(drift * 2.1) * 0.05)) * aspect, v - (0.22 + Math.cos(drift * 1.7) * 0.05));
          var blueD = Math.hypot((u - (0.15 + Math.cos(drift * 1.3) * 0.04)) * aspect, v - (0.85 + Math.sin(drift * 1.9) * 0.04));
          var lum = 0.16 + 0.1 * (1 - v) + Math.max(0, 0.66 - mintD * 1.15) + Math.max(0, 0.3 - blueD * 0.9);
          if (lum > 1) lum = 1;
          // Quantize with the 4x4 ordered matrix (dither lattice).
          var thr = (B[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
          var q = Math.floor(lum * LEVELS + thr) / LEVELS;
          if (q > 1) q = 1;
          // Lens mask: feathered pointer circle over ambient base coverage.
          var dist = Math.hypot((u - px) * aspect, v - py);
          var lens = 0;
          if (act > 0.003) {
            var rr = minorR * act;
            lens = dist >= rr ? 0 : (dist <= inner * act ? 1 : 1 - (dist - inner * act) / Math.max(rr - inner * act, 1e-4));
          }
          var mask = Math.max(lens, BASE) * STRENGTH;
          var apply = thr <= mask ? 1 : 0;
          // Palette: ink -> mint, nudged toward info-blue near the blue blob.
          var bmix = Math.max(0, 0.5 - blueD) * 1.2; if (bmix > 0.55) bmix = 0.55;
          var lr = MINT[0] + (BLUE[0] - MINT[0]) * bmix;
          var lg = MINT[1] + (BLUE[1] - MINT[1]) * bmix;
          var lb = MINT[2] + (BLUE[2] - MINT[2]) * bmix;
          var qq = apply ? q : lum * 0.4;
          d[i] = DARK[0] + (lr - DARK[0]) * qq;
          d[i + 1] = DARK[1] + (lg - DARK[1]) * qq;
          d[i + 2] = DARK[2] + (lb - DARK[2]) * qq;
          d[i + 3] = 255;
          i += 4;
        }
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(off, 0, 0, CW, CH, 0, 0, CW * PIXEL, CH * PIXEL);
    }

    // First frame SYNCHRONOUSLY: background/hidden documents never service
    // requestAnimationFrame, and this page can be prerendered — the settled
    // field must paint regardless.
    frame(0);
    if (reduce) return; // static backdrop, no loop, no lens

    var running = false, prev = 0;
    function loop(ts) {
      if (!running) return;
      var dt = Math.min((ts - prev) / 1000, 1 / 30) || 0; prev = ts;
      var ease = 1 - Math.exp(-dt * FOLLOW);
      px += (tx - px) * ease; py += (ty - py) * ease; act += (tact - act) * ease;
      frame(ts);
      var settled = Math.abs(tx - px) < 5e-4 && Math.abs(ty - py) < 5e-4 && Math.abs(tact - act) < 1e-3
        && (performance.now() - lastMove > 4000);
      if (settled || document.hidden) { running = false; return; }
      requestAnimationFrame(loop);
    }
    function start() { if (running) return; running = true; prev = performance.now(); requestAnimationFrame(loop); }

    window.addEventListener("pointermove", function (e) {
      tx = e.clientX / W; ty = e.clientY / H; tact = 1; lastMove = performance.now(); start();
    }, { passive: true });
    window.addEventListener("pointerleave", function () { tact = 0; start(); }, { passive: true });
    window.addEventListener("resize", function () { size(); frame(performance.now()); start(); });
    document.addEventListener("visibilitychange", function () { if (!document.hidden) { frame(performance.now()); start(); } });
    start();
  })();
  </script>
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

  const code = seal<AuthCode>({ t: "code", key: r.key, cc: p.code_challenge, ru: p.redirect_uri, ci: p.client_id, exp: now() + CODE_TTL, jti: randomId() });
  const dest = new URL(p.redirect_uri);
  dest.searchParams.set("code", code);
  if (p.state) dest.searchParams.set("state", p.state);
  return Response.redirect(dest.toString(), 302);
}
