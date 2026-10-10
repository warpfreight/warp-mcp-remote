// Slack alerts for connector sign-ins, so the team sees who connects Warp to
// their assistant. warp-site already alerts on new self-serve accounts and on
// bookings, but an existing customer signing in here (the common case once the
// connector is advertised) was silent: the only trace was in the logs.
//
// Off unless CONNECTOR_SLACK_WEBHOOK_URL is set. Never throws and never blocks a
// sign-in for long: the post is capped at 2.5s and any failure is swallowed.
// Test traffic never reaches the channel: @example.com addresses are skipped,
// and tests run without the webhook set.

const TIMEOUT_MS = 2500;

export type ConnectorEvent =
  | { kind: "signed_in"; email?: string; agentId?: string; hasCard?: boolean; client: string }
  | { kind: "new_account"; email?: string; agentId?: string; client: string }
  | { kind: "sign_in_failed"; email?: string; error: string; client: string };

/** The assistant behind an authorization request, from its registered redirect URI. */
export function clientName(redirectUri: string): string {
  let host: string;
  try { host = new URL(redirectUri).hostname; } catch { return "unknown"; }
  const is = (d: string) => host === d || host.endsWith("." + d);
  if (is("claude.ai") || is("claude.com") || is("anthropic.com")) return "Claude";
  if (is("chatgpt.com") || is("openai.com")) return "ChatGPT";
  if (is("perplexity.ai")) return "Perplexity";
  if (host === "localhost" || host === "127.0.0.1") return "local";
  return host;
}

/** Wrong passwords are routine; only alert on failures someone may need to fix. */
export function isAlertableFailure(error: string): boolean {
  return !/^(Invalid email or password\.|Enter your email and password\.)$/.test(error.trim());
}

const isTestEmail = (email?: string) => !!email && /@example\.(com|org|net)$/i.test(email.trim());

export function connectorAlertText(e: ConnectorEvent, at: Date = new Date()): string {
  const when = at.toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " PT";
  const who = e.email || "unknown email";
  if (e.kind === "signed_in") {
    return [
      "*Warp connector: customer signed in*",
      `Account: ${who}${e.agentId ? ` (${e.agentId})` : ""}`,
      `Assistant: ${e.client}`,
      `Card on file: ${e.hasCard ? "yes" : "no"}`,
      when,
    ].join("\n");
  }
  if (e.kind === "new_account") {
    return [
      "*Warp connector: new account created*",
      `Account: ${who}${e.agentId ? ` (${e.agentId})` : ""}`,
      `Assistant: ${e.client}`,
      when,
    ].join("\n");
  }
  return [
    "*Warp connector: sign-in failed*",
    `Account: ${who}`,
    `Assistant: ${e.client}`,
    `Shown to the customer: ${e.error}`,
    when,
  ].join("\n");
}

export async function notifyConnector(e: ConnectorEvent): Promise<void> {
  const url = process.env.CONNECTOR_SLACK_WEBHOOK_URL;
  if (!url || isTestEmail(e.email)) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: connectorAlertText(e) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // An alert must never break a sign-in.
  }
}
