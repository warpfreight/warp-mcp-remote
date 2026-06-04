// Stateless OAuth 2.1 primitives for the Warp remote MCP.
// No database: client_id, authorization codes, and access tokens are all
// AES-256-GCM-sealed JSON blobs. Only this server (holding TOKEN_SECRET) can
// open them, so the access token Claude holds is opaque — it never sees the
// underlying Warp API key.
import crypto from "node:crypto";

function secretKey(): Buffer {
  const s = process.env.TOKEN_SECRET;
  if (!s || s.length < 32) {
    throw new Error("TOKEN_SECRET env var must be set to a random string of at least 32 chars");
  }
  return crypto.createHash("sha256").update(s).digest(); // 32 bytes for AES-256
}

const b64url = (b: Buffer) => b.toString("base64url");
const fromB64url = (s: string) => Buffer.from(s, "base64url");

/** Encrypt a JSON-serialisable value into an opaque, tamper-proof token string. */
export function seal<T = unknown>(obj: T): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const pt = Buffer.from(JSON.stringify(obj), "utf8");
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  return b64url(Buffer.concat([iv, tag, ct]));
}

/** Decrypt a sealed token; returns null on any tampering / bad key / parse error. */
export function unseal<T = Record<string, unknown>>(token: string): T | null {
  try {
    const buf = fromB64url(token);
    if (buf.length < 29) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const d = crypto.createDecipheriv("aes-256-gcm", secretKey(), iv);
    d.setAuthTag(tag);
    const pt = Buffer.concat([d.update(ct), d.final()]);
    return JSON.parse(pt.toString("utf8")) as T;
  } catch {
    return null;
  }
}

/** PKCE S256: verify a code_verifier against the stored code_challenge. */
export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false;
  const h = b64url(crypto.createHash("sha256").update(verifier).digest());
  // constant-time compare
  const a = Buffer.from(h);
  const b = Buffer.from(challenge);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const now = () => Math.floor(Date.now() / 1000);

/** Random 128-bit id (base64url) — per-token jti for KV single-use claiming + revocation. */
export const randomId = () => crypto.randomBytes(16).toString("base64url");

// ── Token type shapes ──────────────────────────────────────────────
export type ClientToken = { t: "client"; redirect_uris: string[]; iat: number };
export type AuthCode = { t: "code"; key: string; cc: string; ru: string; ci: string; exp: number; jti: string };
export type AccessToken = { t: "at"; key: string; exp: number; jti: string };
export type RefreshToken = { t: "rt"; key: string; exp: number; jti: string };

// The access token is sent on every MCP request, so keep it short-lived; the
// refresh token (only ever sent to /token) carries continuity. Compliant clients
// rotate via the refresh_token grant, bounding how long a leaked access token works.
export const ACCESS_TTL = 60 * 60 * 24 * 7; // 7 days
export const REFRESH_TTL = 60 * 60 * 24 * 30; // 30 days
export const CODE_TTL = 60; // 60s — tight, near-one-time window for the auth code

/** The public base URL of this deployment, derived from the request host. */
export function originOf(req: Request): string {
  const h = req.headers.get("host") ?? "warp-mcp-remote.vercel.app";
  const proto = h.startsWith("localhost") || h.startsWith("127.") ? "http" : "https";
  return `${proto}://${h}`;
}
