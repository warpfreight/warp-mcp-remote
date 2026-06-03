// Authenticate a Warp customer (email + password) and return their raw Warp API
// key. Mirrors the flow the published `warp_login` MCP tool uses against the
// Warp customer portal — so no new Warp backend work is required.
//
// NOTE: this handles end-user credentials. It must only run server-side, over
// HTTPS, and ideally be served from a Warp-owned domain (mcp.wearewarp.com).
const CUSTOMER_URL = process.env.WARP_CUSTOMER_URL ?? "https://customer.wearewarp.com";

function appHeader(): Record<string, string> {
  const ts = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
  return { "Content-Type": "application/json", app: `4;0.1.362;${ts}`, Origin: CUSTOMER_URL };
}

export type LoginResult = { ok: true; key: string } | { ok: false; error: string };

export async function loginAndGetKey(email: string, password: string): Promise<LoginResult> {
  try {
    const headers = appHeader();
    const authRes = await fetch(`${CUSTOMER_URL}/api/auth/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10000),
    });
    if (!authRes.ok) return { ok: false, error: "Invalid email or password." };
    const authData = (await authRes.json()) as { accessToken?: string };
    const accessToken = authData.accessToken;
    if (!accessToken) return { ok: false, error: "No access token returned." };

    const authed = { ...headers, Authorization: `Bearer ${accessToken}` };
    let rawKey: string | null = null;
    const keyRes = await fetch(`${CUSTOMER_URL}/api/developer/apikey`, { headers: authed, signal: AbortSignal.timeout(10000) });
    if (keyRes.ok) {
      const kd = (await keyRes.json()) as { value?: string };
      rawKey = kd.value ?? null;
    }
    if (!rawKey) {
      // Generate one if the account has none yet, then re-fetch.
      await fetch(`${CUSTOMER_URL}/api/developer/apikey`, { method: "POST", headers: authed, signal: AbortSignal.timeout(10000) });
      const re = await fetch(`${CUSTOMER_URL}/api/developer/apikey`, { headers: authed, signal: AbortSignal.timeout(10000) });
      if (re.ok) rawKey = ((await re.json()) as { value?: string }).value ?? null;
    }
    if (!rawKey) return { ok: false, error: "Could not retrieve a Warp API key for this account." };
    return { ok: true, key: rawKey };
  } catch {
    return { ok: false, error: "Could not reach the Warp login service. Try again." };
  }
}
