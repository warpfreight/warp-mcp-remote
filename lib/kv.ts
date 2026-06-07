import { Redis } from "@upstash/redis";

// Upstash Redis (provisioned via the Vercel Marketplace integration). Backs the
// two stateful OAuth controls a stateless seal can't provide on its own:
//   1. strictly single-use authorization codes
//   2. access / refresh token revocation
//
// If the KV env is absent (e.g. local dev without the integration) every helper
// fails OPEN — the app keeps working with signature-only validation, just without
// these extra controls. So a KV outage degrades security, never availability.
function makeClient(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = makeClient();
export const kvEnabled = redis !== null;

/**
 * Atomically claim a one-time authorization code by its jti. Returns true the
 * first time (claim succeeded → proceed) and false if the jti was already used
 * (replay → reject). Fails OPEN (true) if KV is unavailable.
 */
export async function claimAuthCode(jti: string, ttlSeconds: number): Promise<boolean> {
  if (!redis || !jti) return true;
  try {
    const res = await redis.set(`code:${jti}`, "1", { nx: true, ex: Math.max(1, ttlSeconds) });
    return res === "OK";
  } catch {
    return true; // never block a legitimate login on a KV hiccup
  }
}

/**
 * Atomically claim a one-time checkout session by its jti (separate namespace
 * from auth codes). Returns true the first time (proceed to book) and false on
 * replay (already booked). Fails OPEN (true) if KV is unavailable — matches the
 * auth-code policy: a KV outage degrades the single-use guarantee, never blocks
 * a legitimate booking. The short session TTL + one-click UI bound the exposure.
 */
export async function claimCheckout(jti: string, ttlSeconds: number): Promise<boolean> {
  if (!redis || !jti) return true;
  try {
    const res = await redis.set(`checkout:${jti}`, "1", { nx: true, ex: Math.max(1, ttlSeconds) });
    return res === "OK";
  } catch {
    return true;
  }
}

/** Revoke a token by jti for the remainder of its lifetime. Best-effort. */
export async function revokeToken(jti: string, ttlSeconds: number): Promise<void> {
  if (!redis || !jti || ttlSeconds <= 0) return;
  try {
    await redis.set(`revoked:${jti}`, "1", { ex: Math.max(1, ttlSeconds) });
  } catch {
    /* best effort */
  }
}

/** True if the token jti has been revoked. Fails OPEN (false) on KV error. */
export async function isRevoked(jti: string): Promise<boolean> {
  if (!redis || !jti) return false;
  try {
    return (await redis.get(`revoked:${jti}`)) !== null;
  } catch {
    return false; // availability over revocation when KV is unreachable
  }
}
