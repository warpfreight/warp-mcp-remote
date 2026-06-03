import { seal, now, type ClientToken } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dynamic Client Registration (RFC 7591). Claude registers itself with its
// redirect_uris; we return a stateless client_id that *encodes* those URIs
// (sealed), so /authorize can validate redirect_uri without a database.
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty body ok */
  }
  const rawUris = Array.isArray(body.redirect_uris) ? (body.redirect_uris as unknown[]) : [];
  const redirect_uris = rawUris
    .filter((u): u is string => typeof u === "string")
    .filter((u) => {
      try {
        const url = new URL(u);
        return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1";
      } catch {
        return false;
      }
    });

  if (redirect_uris.length === 0) {
    return Response.json({ error: "invalid_redirect_uri", error_description: "At least one https redirect_uri is required." }, { status: 400 });
  }

  const client: ClientToken = { t: "client", redirect_uris, iat: now() };
  const client_id = seal(client);

  return Response.json(
    {
      client_id,
      redirect_uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      client_id_issued_at: client.iat,
    },
    { status: 201 },
  );
}
