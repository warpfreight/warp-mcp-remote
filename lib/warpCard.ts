// Card-on-file for the connector auth page. After a user signs up (or signs in)
// we can let them add a card without leaving the connect window, writing to the
// SAME card on file the wearewarp.com/agents/account page uses.
//
// Flow (mirrors the onboard "update card" path):
//   1. update-card-intent { agent_id, session_token } -> { client_secret }
//      (a fresh Stripe SetupIntent on the agent's existing Stripe customer;
//       setup-card is new-account-only and 409s an existing account by design)
//   2. browser: Stripe Elements + stripe.confirmSetup(client_secret) -> payment_method
//   3. save-payment-method { agent_id, payment_method_id, session_token }
//      -> sets it as the default so /api/v1/book stops returning 402.
//
// All the Stripe *secret*-key work stays server-side inside warp-site; this
// service only ever handles the public client_secret + publishable key.
import { CONNECTOR_UA } from "./ua";

const WARP_SITE = process.env.WARP_SITE_URL ?? "https://www.wearewarp.com";

function headers(ip?: string): Record<string, string> {
  return {
    "user-agent": CONNECTOR_UA,
    "Content-Type": "application/json",
    ...(ip ? { "X-Forwarded-For": ip } : {}),
  };
}

export type CardIntent = { ok: true; clientSecret: string } | { ok: false; error: string };

/** Step 1 — mint a SetupIntent client_secret for an existing agent's customer. */
export async function cardIntent(agentId: string, sessionToken: string, ip?: string): Promise<CardIntent> {
  try {
    const res = await fetch(`${WARP_SITE}/api/v1/agents/update-card-intent`, {
      method: "POST",
      headers: headers(ip),
      body: JSON.stringify({ agent_id: agentId, session_token: sessionToken }),
      signal: AbortSignal.timeout(20000),
    });
    const data = (await res.json().catch(() => ({}))) as { client_secret?: string; error?: string };
    if (!res.ok || !data.client_secret) {
      return { ok: false, error: data.error || "Could not start the card setup." };
    }
    return { ok: true, clientSecret: data.client_secret };
  } catch {
    return { ok: false, error: "Could not reach the Warp card service." };
  }
}

export type SaveCard = { ok: true } | { ok: false; error: string };

/** Step 3 — record the confirmed payment method as the account's default. */
export async function savePaymentMethod(
  agentId: string,
  paymentMethodId: string,
  sessionToken: string,
  ip?: string,
): Promise<SaveCard> {
  try {
    const res = await fetch(`${WARP_SITE}/api/v1/agents/save-payment-method`, {
      method: "POST",
      headers: headers(ip),
      body: JSON.stringify({ agent_id: agentId, payment_method_id: paymentMethodId, session_token: sessionToken }),
      signal: AbortSignal.timeout(20000),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: data.error || "Could not save the card." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach the Warp card service." };
  }
}
