// In-flow account creation for the connector's OAuth page. Calls warp-site's
// self-serve signup (www.wearewarp.com/api/v1/agents/signup), the same endpoint
// the onboard page uses, so a prospect can create a Warp account without leaving
// the connect window. warp-site does the gw customer-portal signup internally and
// returns the scoped wak_live_ proxy key; this service never sees the raw key.
//
// Signup is two-step (gw requires email verification):
//   1. startSignup(...)            -> { verification_required, challengeId }  (code emailed)
//   2. verifySignup(..., otp)      -> { key }                                (account created)
// A rare account with verification disabled returns the key straight from step 1.
import { CONNECTOR_UA } from "./ua";

const WARP_SITE = process.env.WARP_SITE_URL ?? "https://www.wearewarp.com";

export type SignupFields = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  companyName?: string;
  // Anti-abuse fields warp-site's signup gate expects (see signup-abuse.ts):
  // the honeypots must be empty, and form_rendered_at lets it reject instant
  // bot submits. The connector renders these with the auth page.
  website?: string; // honeypot — always empty for a real user
  contactPrefAlt?: string; // honeypot — always empty for a real user
  formRenderedAt?: string; // epoch ms string, stamped when the page rendered
};

export type Account = { key: string; agentId?: string; email?: string; sessionToken?: string };

export type SignupStart =
  | { ok: true; verification_required: true; challengeId: string }
  | ({ ok: true; verification_required: false } & Account)
  | { ok: false; error: string };

export type SignupVerify = ({ ok: true } & Account) | { ok: false; error: string };

function baseBody(f: SignupFields): Record<string, unknown> {
  return {
    email: f.email,
    password: f.password,
    firstName: f.firstName,
    lastName: f.lastName,
    phone: f.phone,
    companyName: f.companyName || undefined,
    // pass the anti-abuse fields through verbatim
    website: f.website ?? "",
    contact_pref_alt: f.contactPrefAlt ?? "",
    form_rendered_at: f.formRenderedAt ?? undefined,
  };
}

function headers(ip?: string): Record<string, string> {
  return {
    "user-agent": CONNECTOR_UA, // attribute this signup to the MCP connector door
    "Content-Type": "application/json",
    // Forward the end-user's IP so warp-site rate-limits per user, not per this
    // service's shared serverless egress IP.
    ...(ip ? { "X-Forwarded-For": ip } : {}),
  };
}

function keyFrom(data: { production_key?: string; booking_key?: string }): string | null {
  return data.production_key || data.booking_key || null;
}

/** Step 1: submit the signup. Usually returns a challengeId (code emailed). */
export async function startSignup(f: SignupFields, ip?: string): Promise<SignupStart> {
  try {
    const res = await fetch(`${WARP_SITE}/api/v1/agents/signup`, {
      method: "POST",
      headers: headers(ip),
      body: JSON.stringify(baseBody(f)),
      signal: AbortSignal.timeout(20000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      verification_required?: boolean;
      challenge_id?: string;
      production_key?: string;
      booking_key?: string;
      agentId?: string;
      email?: string;
      session_token?: string;
      error?: string;
      code?: string;
    };
    if (!res.ok) {
      if (data.code === "EMAIL_TAKEN")
        return { ok: false, error: "An account with this email already exists. Sign in instead." };
      return { ok: false, error: data.error || "Could not create your account. Please try again." };
    }
    if (data.verification_required && data.challenge_id) {
      return { ok: true, verification_required: true, challengeId: data.challenge_id };
    }
    const key = keyFrom(data);
    if (key) return { ok: true, verification_required: false, key, agentId: data.agentId, email: data.email, sessionToken: data.session_token ?? undefined };
    return { ok: false, error: "Signup did not complete. Please try again." };
  } catch {
    return { ok: false, error: "Could not reach the Warp signup service. Try again." };
  }
}

/** Step 2: submit the emailed code to finish creating the account. */
export async function verifySignup(
  f: SignupFields,
  challengeId: string,
  otp: string,
  ip?: string,
): Promise<SignupVerify> {
  try {
    const res = await fetch(`${WARP_SITE}/api/v1/agents/signup`, {
      method: "POST",
      headers: headers(ip),
      body: JSON.stringify({ ...baseBody(f), challenge_id: challengeId, otp }),
      signal: AbortSignal.timeout(20000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      production_key?: string;
      booking_key?: string;
      agentId?: string;
      email?: string;
      session_token?: string;
      error?: string;
      code?: string;
    };
    if (!res.ok) {
      if (data.code === "INVALID_OTP")
        return { ok: false, error: data.error || "That code didn't match. Check the email and try again." };
      return { ok: false, error: data.error || "Could not finish creating your account. Please try again." };
    }
    const key = keyFrom(data);
    if (key) return { ok: true, key, agentId: data.agentId, email: data.email, sessionToken: data.session_token ?? undefined };
    return { ok: false, error: "Account created but no key was returned. Try signing in." };
  } catch {
    return { ok: false, error: "Could not reach the Warp signup service. Try again." };
  }
}
