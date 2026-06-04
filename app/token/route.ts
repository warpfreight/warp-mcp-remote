import { unseal, seal, now, ACCESS_TTL, REFRESH_TTL, verifyPkceS256, randomId, type AuthCode, type AccessToken, type RefreshToken } from "@/lib/oauth";
import { claimAuthCode, isRevoked } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readBody(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      return (await req.json()) as Record<string, string>;
    } catch {
      return {};
    }
  }
  const f = await req.formData();
  const o: Record<string, string> = {};
  for (const [k, v] of f) o[k] = String(v);
  return o;
}

const bad = (desc: string) => Response.json({ error: "invalid_grant", error_description: desc }, { status: 400 });

function issueTokens(key: string): Response {
  const access_token = seal<AccessToken>({ t: "at", key, exp: now() + ACCESS_TTL, jti: randomId() });
  const refresh_token = seal<RefreshToken>({ t: "rt", key, exp: now() + REFRESH_TTL, jti: randomId() });
  return Response.json({ access_token, token_type: "Bearer", expires_in: ACCESS_TTL, refresh_token, scope: "warp" });
}

export async function POST(req: Request) {
  const b = await readBody(req);

  if (b.grant_type === "authorization_code") {
    const ac = unseal<AuthCode>(String(b.code ?? ""));
    if (!ac || ac.t !== "code") return bad("invalid code");
    if (ac.exp < now()) return bad("code expired");
    if (ac.ru !== String(b.redirect_uri ?? "")) return bad("redirect_uri mismatch");
    if (ac.ci !== String(b.client_id ?? "")) return bad("client mismatch");
    if (!verifyPkceS256(String(b.code_verifier ?? ""), ac.cc)) return bad("PKCE verification failed");
    // Strictly one-time use: claim the code's jti (KV). Replay within TTL is rejected.
    if (!(await claimAuthCode(ac.jti, ac.exp - now()))) return bad("authorization code already used");
    return issueTokens(ac.key);
  }

  if (b.grant_type === "refresh_token") {
    const rt = unseal<RefreshToken>(String(b.refresh_token ?? ""));
    if (!rt || rt.t !== "rt") return bad("invalid refresh_token");
    if (rt.exp < now()) return bad("refresh_token expired");
    if (await isRevoked(rt.jti)) return bad("refresh_token revoked");
    return issueTokens(rt.key);
  }

  return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
}
