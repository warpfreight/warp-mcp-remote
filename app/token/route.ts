import { unseal, seal, now, ACCESS_TTL, verifyPkceS256, type AuthCode, type AccessToken } from "@/lib/oauth";

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

export async function POST(req: Request) {
  const b = await readBody(req);
  if (b.grant_type !== "authorization_code") {
    return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
  }
  const ac = unseal<AuthCode>(String(b.code ?? ""));
  if (!ac || ac.t !== "code") return bad("invalid code");
  if (ac.exp < now()) return bad("code expired");
  if (ac.ru !== String(b.redirect_uri ?? "")) return bad("redirect_uri mismatch");
  if (ac.ci !== String(b.client_id ?? "")) return bad("client mismatch");
  if (!verifyPkceS256(String(b.code_verifier ?? ""), ac.cc)) return bad("PKCE verification failed");

  const access_token = seal<AccessToken>({ t: "at", key: ac.key, exp: now() + ACCESS_TTL });
  return Response.json({ access_token, token_type: "Bearer", expires_in: ACCESS_TTL, scope: "warp" });
}
