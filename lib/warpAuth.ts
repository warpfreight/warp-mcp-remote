// Authenticate a Warp customer via warp-site's self-serve proxy login and return
// their scoped **wak_live_ proxy key** (NOT the raw upstream key).
//
// warp-site (www.wearewarp.com/api/v1) is the proxy layer on top of the actual
// Warp API: POST /api/v1/agents/login does the customer-portal auth internally,
// stores the raw upstream key encrypted server-side, mints/returns only the
// agent's `wak_live_` proxy key, and rate-limits the attempt. This service
// therefore never touches the raw upstream key — it only ever sees/forwards the
// scoped proxy key, which is the same key the /api/v1/warp gateway expects.
import { CONNECTOR_UA } from "./ua";

const WARP_SITE = process.env.WARP_SITE_URL ?? "https://www.wearewarp.com";

export type LoginResult =
  | { ok: true; key: string; agentId?: string; email?: string; sessionToken?: string; hasCard?: boolean }
  | { ok: false; error: string };

export async function loginAndGetKey(email: string, password: string, ip?: string): Promise<LoginResult> {
  try {
    const res = await fetch(`${WARP_SITE}/api/v1/agents/login`, {
      method: "POST",
      headers: {
        // Tag the sign-in/mint call so this key's creation is attributable to
        // the MCP connector door server-side.
        "user-agent": CONNECTOR_UA,
        "Content-Type": "application/json",
        // Forward the end-user's IP so warp-site rate-limits per user, not per
        // this service's shared serverless egress IP.
        ...(ip ? { "X-Forwarded-For": ip } : {}),
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(20000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      production_key?: string;
      booking_key?: string;
      agent_id?: string;
      email?: string;
      session_token?: string;
      has_card?: boolean;
      error?: string;
    };
    if (!res.ok) return { ok: false, error: data.error || "Invalid email or password." };
    const key = data.production_key || data.booking_key; // wak_live_ proxy key
    if (!key) return { ok: false, error: data.error || "No API key found for this account." };
    return { ok: true, key, agentId: data.agent_id, email: data.email, sessionToken: data.session_token ?? undefined, hasCard: !!data.has_card };
  } catch {
    return { ok: false, error: "Could not reach the Warp login service. Try again." };
  }
}
