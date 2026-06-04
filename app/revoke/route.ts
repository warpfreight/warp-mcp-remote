import { unseal, now, type AccessToken, type RefreshToken } from "@/lib/oauth";
import { revokeToken } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// OAuth 2.0 Token Revocation (RFC 7009). Accepts an access or refresh token and
// adds its jti to the revocation list for the remainder of its lifetime. Per spec
// we always return 200, even for unknown/invalid tokens (no token-state oracle).
export async function POST(req: Request) {
  let token = "";
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const j = (await req.json()) as Record<string, string>;
      token = String(j.token ?? "");
    } else {
      const f = await req.formData();
      token = String(f.get("token") ?? "");
    }
  } catch {
    /* malformed body → still return 200 per spec */
  }

  if (token) {
    const at = unseal<AccessToken>(token);
    if (at && at.t === "at" && at.jti) await revokeToken(at.jti, at.exp - now());
    const rt = unseal<RefreshToken>(token);
    if (rt && rt.t === "rt" && rt.jti) await revokeToken(rt.jti, rt.exp - now());
  }

  return new Response(null, { status: 200 });
}
