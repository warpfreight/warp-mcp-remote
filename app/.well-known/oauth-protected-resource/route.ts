import { originOf } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// OAuth 2.0 Protected Resource Metadata (RFC 9728) — the MCP endpoint points
// here via WWW-Authenticate so the client knows which authorization server to use.
export async function GET(req: Request) {
  const base = originOf(req);
  return Response.json({
    resource: `${base}/api/mcp`,
    authorization_servers: [base],
    scopes_supported: ["warp"],
    bearer_methods_supported: ["header"],
  });
}
