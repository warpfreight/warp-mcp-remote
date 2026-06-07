// Sealed, single-use checkout session for the ChatGPT app's external-checkout flow.
//
// OpenAI's Apps SDK forbids charging for a service inside ChatGPT, so the ChatGPT
// MCP endpoint's `warp_book` can't charge. Instead it mints one of these sessions
// and links the user out to `/checkout`, where they confirm + pay on our own
// domain (the documented "external checkout" pattern).
//
// The session is AES-256-GCM sealed (reusing lib/oauth seal/unseal), so the user's
// Warp key rides in the URL only as opaque ciphertext — never plaintext. It's
// short-lived (30 min) and single-use (KV jti claim at book time).
import { seal, unseal, now, randomId } from "@/lib/oauth";
import { claimCheckout } from "@/lib/kv";

export type CheckoutAddr = {
  contactName?: string;
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
};

export type CheckoutSession = {
  t: "co";
  key: string; // the user's wak_live_ proxy key — sealed, never exposed in plaintext
  quote_id: string;
  amount_usd?: number; // display only; the authoritative charge comes from /api/v1/book
  mode?: string;
  origin_zip?: string;
  destination_zip?: string;
  pickup_date?: string;
  pickup?: CheckoutAddr; // pre-fills the checkout form when the model captured it
  delivery?: CheckoutAddr;
  exp: number;
  jti: string;
};

export const CHECKOUT_TTL = 60 * 30; // 30 minutes

/** Mint a sealed checkout token from the (already-authenticated) booking context. */
export function sealCheckout(
  input: Omit<CheckoutSession, "t" | "exp" | "jti">,
): string {
  const session: CheckoutSession = {
    t: "co",
    ...input,
    exp: now() + CHECKOUT_TTL,
    jti: randomId(),
  };
  return seal(session);
}

/** Open + validate a sealed token WITHOUT consuming it (for rendering the page). */
export function peekCheckout(token: string): CheckoutSession | null {
  const s = unseal<CheckoutSession>(token);
  if (!s || s.t !== "co" || typeof s.key !== "string" || s.exp < now()) return null;
  return s;
}

/**
 * Open + atomically consume a checkout session (single-use). Call immediately
 * before booking. Returns null if the token is invalid/expired or already used.
 */
export async function consumeCheckout(token: string): Promise<CheckoutSession | null> {
  const s = peekCheckout(token);
  if (!s) return null;
  const claimed = await claimCheckout(s.jti, Math.max(1, s.exp - now()));
  if (!claimed) return null; // replay → already booked
  return s;
}
