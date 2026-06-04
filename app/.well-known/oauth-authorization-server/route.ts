import { originOf } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// OAuth 2.1 Authorization Server Metadata (RFC 8414) — Claude reads this to
// discover the authorize/token/register endpoints.
export async function GET(req: Request) {
  const base = originOf(req);
  return Response.json({
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    revocation_endpoint: `${base}/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["warp"],
  });
}
