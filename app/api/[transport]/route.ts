import { createMcpHandler } from "mcp-handler";
import { AsyncLocalStorage } from "node:async_hooks";
import { unseal, originOf, now, type AccessToken } from "@/lib/oauth";
import { isRevoked, anonRateAllow } from "@/lib/kv";
// Deep-import the LIVE published tool definitions (pinned to warp-agent-mcp@0.16.0).
// No vendoring — bump the dependency to pick up new tool versions.
// @ts-ignore — package ships dist/*.js without type declarations
import { registerTools } from "warp-agent-mcp/dist/tools.js";
// @ts-ignore
import { WarpClient } from "warp-agent-mcp/dist/client.js";
// Widget card resources (the inline cards). Registered below — mirrors
// warp-agent-mcp/dist/index.js. Deep imports; package ships no exports map.
// @ts-ignore
import { QUOTE_CARD_RESOURCE_URI, QUOTE_CARD_MCP_RESOURCE_URI, MCP_APP_MIME_TYPE, quoteCardTemplate, quoteCardMcpTemplate } from "warp-agent-mcp/dist/widgets/quote-card.js";
// @ts-ignore
import { BOOKINGS_CARD_RESOURCE_URI, BOOKINGS_CARD_MCP_RESOURCE_URI, bookingsCardTemplate, bookingsCardMcpTemplate } from "warp-agent-mcp/dist/widgets/bookings-card.js";
// @ts-ignore
import { BATCH_QUOTE_CARD_RESOURCE_URI, BATCH_QUOTE_CARD_MCP_RESOURCE_URI, batchQuoteCardTemplate, batchQuoteCardMcpTemplate } from "warp-agent-mcp/dist/widgets/batch-quote-card.js";
// @ts-ignore
import { BATCH_BOOK_CARD_RESOURCE_URI, BATCH_BOOK_CARD_MCP_RESOURCE_URI, batchBookCardTemplate, batchBookCardMcpTemplate } from "warp-agent-mcp/dist/widgets/batch-book-card.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const WARP_API_URL = process.env.WARP_API_URL ?? "https://www.wearewarp.com/api/v1/warp";

// Per-request auth context, scoped via AsyncLocalStorage (multi-tenant):
// `key` is the resolved Warp API key (absent = ANONYMOUS session — keyless
// discovery, backlog step 4); `ip` is the END CLIENT's IP, forwarded upstream
// so warp-site's anonymous quote limiter (60/hr PER IP, keyed on the first
// x-forwarded-for entry) buckets each end user separately instead of all
// anonymous traffic sharing — and exhausting — this server's single egress IP.
type ReqCtx = { key?: string; ip?: string };
const ctxStore = new AsyncLocalStorage<ReqCtx>();
const getApiKey = (): string | undefined => ctxStore.getStore()?.key;
const getClientIp = (): string | undefined => ctxStore.getStore()?.ip;

/** Tools an ANONYMOUS session may call — exactly the surface that is public
 *  and keyless on the REST API (each verified: upstream prices these with the
 *  house account when no key is sent). Everything else needs a Warp account:
 *  multistop_quote is NOT here because its upstream 401s without a key, and
 *  booking/tracking/account tools obviously gate. `status` is the public
 *  health check. */
const ANON_TOOLS = new Set([
  "van_quote",
  "box_truck_quote",
  "ftl_quote",
  "ltl_quote",
  "ltl_market_options",
  "compare_modes",
  "batch_quote",
  "status",
]);

/** Keyless discovery kill switch: set ANON_DISCOVERY=0 to restore the old
 *  401-on-everything behavior instantly (env change, no code rollback). */
const anonDiscoveryEnabled = () =>
  !/^(0|false|off)$/i.test(process.env.ANON_DISCOVERY ?? "");

function authRequiredResult(tool: string) {
  return {
    content: [{
      type: "text" as const,
      text:
        `Sign in to Warp to use \`${tool}\`. Quotes are free and need no account — ` +
        `\`compare_modes\`, \`ltl_quote\`, \`ftl_quote\`, \`van_quote\`, \`box_truck_quote\`, ` +
        `\`ltl_market_options\`, and \`batch_quote\` all work right now, unauthenticated.\n\n` +
        `Next: connect your Warp account to this connector (in Claude: Settings → Connectors → Warp → Sign in, ` +
        `or remove and re-add https://mcp.wearewarp.com/api/mcp and complete the sign-in prompt). ` +
        `New to Warp? Create an account at https://www.wearewarp.com/agents/account — then retry \`${tool}\`.`,
    }],
    isError: true,
  };
}

const handler = createMcpHandler(
  (server: unknown) => {
    // Third arg forwards the end client's IP upstream (see ReqCtx above) — added
    // in warp-agent-mcp 0.16.0; core headers always win on conflict.
    const client = new WarpClient(WARP_API_URL, getApiKey, (): Record<string, string> => {
      const ip = getClientIp();
      return ip ? { "x-forwarded-for": ip } : {};
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = server as any;
    registerTools(s, client as any, getApiKey);
    // Gate non-public tools for ANONYMOUS sessions at the dispatch layer, not
    // just via upstream 401s: the rejection is instant, costs no upstream call,
    // and names the fix (the Anthropic error-UX bar). Wraps the registered
    // callbacks in place; authenticated sessions pass straight through.
    // Best-effort on SDK internals: if the registry shape ever changes, tools
    // stay ungated and anonymous calls fall through to upstream auth errors —
    // uglier message, still fail-closed (booking REQUIRES a key upstream).
    try {
      // SDK ≥1.26 stores the executable as `handler` (its update({callback})
      // maps onto .handler); older builds used `callback`. Wrap whichever is
      // present and write BOTH back, so the gate holds across SDK versions —
      // verified live: wrapping only `callback` on 1.26 was a silent no-op and
      // anonymous calls sailed through to the real handlers.
      const reg = (s as {
        _registeredTools?: Record<string, {
          handler?: (...a: unknown[]) => unknown;
          callback?: (...a: unknown[]) => unknown;
        }>;
      })._registeredTools ?? {};
      const setImpl = (tool: { handler?: unknown; callback?: unknown }, fn: (...a: unknown[]) => unknown) => {
        tool.handler = fn;
        tool.callback = fn;
      };
      for (const [name, tool] of Object.entries(reg)) {
        const orig = tool.handler ?? tool.callback;
        if (typeof orig !== "function") continue;
        if (name === "login") {
          // The in-chat email+password login is for the LOCAL npx install (it
          // persists a key to the machine's own disk). On a shared, serverless
          // remote it must never run: per-request auth here is OAuth, and
          // accepting passwords into a multi-tenant lambda is credential
          // hygiene we refuse on principle. Gated for EVERY session.
          setImpl(tool, () => ({
            content: [{
              type: "text" as const,
              text:
                "This hosted connector authenticates with OAuth, not in-chat credentials — " +
                "never send your Warp password in chat. Use your client's connector sign-in " +
                "(in Claude: Settings → Connectors → Warp → Sign in). The `login` tool only " +
                "exists for the local `npx warp-agent-mcp` install.",
            }],
            isError: true,
          }));
          continue;
        }
        if (ANON_TOOLS.has(name)) continue;
        setImpl(tool, (...args: unknown[]) => {
          if (!getApiKey()) return authRequiredResult(name);
          return orig(...args);
        });
      }
    } catch (e) {
      console.error("[mcp] anonymous tool-gating unavailable:", e);
    }
    // Widget card resources. registerTools tags each tool result with one of these
    // resource URIs; without the resources registered, the client can't fetch the card
    // HTML and shows "There was a problem displaying content from Warp". Mirrors
    // warp-agent-mcp/dist/index.js exactly — two host variants per card (text/html for
    // ChatGPT Apps, MCP_APP_MIME_TYPE for Claude MCP Apps).
    s.registerResource("warp-quote-card", QUOTE_CARD_RESOURCE_URI,
      { description: "Inline quote card after van_quote / box_truck_quote / ftl_quote / ltl_quote.", mimeType: "text/html" },
      async () => ({ contents: [{ uri: QUOTE_CARD_RESOURCE_URI, mimeType: "text/html", text: quoteCardTemplate() }] }));
    s.registerResource("warp-quote-card-mcp", QUOTE_CARD_MCP_RESOURCE_URI,
      { description: "Inline quote card (MCP Apps) after van_quote / box_truck_quote / ftl_quote / ltl_quote.", mimeType: MCP_APP_MIME_TYPE },
      async () => ({ contents: [{ uri: QUOTE_CARD_MCP_RESOURCE_URI, mimeType: MCP_APP_MIME_TYPE, text: quoteCardMcpTemplate() }] }));
    s.registerResource("warp-bookings-card", BOOKINGS_CARD_RESOURCE_URI,
      { description: "Inline shipments card after list_bookings.", mimeType: "text/html" },
      async () => ({ contents: [{ uri: BOOKINGS_CARD_RESOURCE_URI, mimeType: "text/html", text: bookingsCardTemplate() }] }));
    s.registerResource("warp-bookings-card-mcp", BOOKINGS_CARD_MCP_RESOURCE_URI,
      { description: "Inline shipments card (MCP Apps) after list_bookings.", mimeType: MCP_APP_MIME_TYPE },
      async () => ({ contents: [{ uri: BOOKINGS_CARD_MCP_RESOURCE_URI, mimeType: MCP_APP_MIME_TYPE, text: bookingsCardMcpTemplate() }] }));
    s.registerResource("warp-batch-quote-card", BATCH_QUOTE_CARD_RESOURCE_URI,
      { description: "Inline batch-quote card after batch_quote.", mimeType: "text/html" },
      async () => ({ contents: [{ uri: BATCH_QUOTE_CARD_RESOURCE_URI, mimeType: "text/html", text: batchQuoteCardTemplate() }] }));
    s.registerResource("warp-batch-quote-card-mcp", BATCH_QUOTE_CARD_MCP_RESOURCE_URI,
      { description: "Inline batch-quote card (MCP Apps) after batch_quote.", mimeType: MCP_APP_MIME_TYPE },
      async () => ({ contents: [{ uri: BATCH_QUOTE_CARD_MCP_RESOURCE_URI, mimeType: MCP_APP_MIME_TYPE, text: batchQuoteCardMcpTemplate() }] }));
    s.registerResource("warp-batch-book-card", BATCH_BOOK_CARD_RESOURCE_URI,
      { description: "Inline batch-book progress card after batch_book.", mimeType: "text/html" },
      async () => ({ contents: [{ uri: BATCH_BOOK_CARD_RESOURCE_URI, mimeType: "text/html", text: batchBookCardTemplate() }] }));
    s.registerResource("warp-batch-book-card-mcp", BATCH_BOOK_CARD_MCP_RESOURCE_URI,
      { description: "Inline batch-book progress card (MCP Apps) after batch_book.", mimeType: MCP_APP_MIME_TYPE },
      async () => ({ contents: [{ uri: BATCH_BOOK_CARD_MCP_RESOURCE_URI, mimeType: MCP_APP_MIME_TYPE, text: batchBookCardMcpTemplate() }] }));
  },
  {
    // MCP 2025-11-25 (SEP-973) `icons`: clients that render server icons (Claude
    // Desktop, future claude.ai) pick these up post-connect. The connector-list icon
    // shown *before* auth comes from the domain favicon (/icon.svg, /favicon.ico),
    // which is the primary channel — this is belt-and-suspenders for spec-aware clients.
    serverInfo: {
      name: "warp-agent-mcp",
      version: "0.16.0",
      icons: [
        { src: "https://mcp.wearewarp.com/icon.png", mimeType: "image/png", sizes: ["512x512"] },
        { src: "https://mcp.wearewarp.com/icon.svg", mimeType: "image/svg+xml", sizes: ["any"] },
      ],
    } as unknown as { name: string; version: string },
  },
  { basePath: "/api", maxDuration: 60 },
);

/** Raw credential from the request (OAuth access token, raw key, or Smithery config). */
function credentialFrom(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth && /^bearer\s+/i.test(auth)) {
    const t = auth.replace(/^bearer\s+/i, "").trim();
    if (t) return t;
  }
  const x = req.headers.get("x-warp-key");
  if (x) return x.trim();
  const url = new URL(req.url);
  const q = url.searchParams.get("warpApiKey") || url.searchParams.get("api_key");
  if (q) return q.trim();
  const cfg = url.searchParams.get("config");
  if (cfg) {
    try {
      const obj = JSON.parse(Buffer.from(cfg, "base64").toString("utf8"));
      if (obj && typeof obj.warpApiKey === "string" && obj.warpApiKey) return obj.warpApiKey;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Origin allowlist (DNS-rebinding protection). A request with no Origin is a
 *  server-to-server call (Claude's backend) and is allowed; Bearer-token auth is
 *  the primary control. A browser request from an untrusted Origin is rejected. */
function isAllowedOrigin(origin: string): boolean {
  let host: string;
  try { host = new URL(origin).hostname; } catch { return false; }
  const ok = (d: string) => host === d || host.endsWith("." + d);
  return ok("claude.ai") || ok("claude.com") || ok("anthropic.com") || ok("chatgpt.com") || ok("openai.com") || ok("wearewarp.com") || host === "localhost" || host === "127.0.0.1";
}

const withAuth = async (req: Request): Promise<Response> => {
  // Keep-warm probe (hit by a Vercel Cron every few minutes). Returns immediately,
  // but booting this instance loads the heavy MCP module at module-init, so real
  // first-calls don't pay a cold start — which otherwise exceeds Claude's tool-call
  // timeout and surfaces as "Unable to reach Warp".
  if (new URL(req.url).searchParams.get("warm") === "1") {
    return new Response("ok", { status: 200, headers: { "Cache-Control": "no-store" } });
  }
  // Cross-origin / DNS-rebinding protection.
  const origin = req.headers.get("origin");
  if (origin && !isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ error: "forbidden", error_description: "Origin not allowed." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  const clientIp = endClientIp(req);
  const cred = credentialFrom(req);
  if (!cred) {
    // KEYLESS DISCOVERY (backlog step 4): no credential no longer means 401.
    // initialize and tools/list work anonymously — a stranger can add the
    // connector and see what Warp does — and the quote tools (public + keyless
    // on the REST API by design) are callable. Everything else is gated per
    // tool with a sign-in pointer. ANON_DISCOVERY=0 restores the old behavior.
    if (!anonDiscoveryEnabled()) {
      const base = originOf(req);
      return new Response(JSON.stringify({ error: "unauthorized", error_description: "Authentication required." }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`,
        },
      });
    }
    // Anonymous ceiling: 60 tool calls/hr per end-client IP (Upstash-backed,
    // cross-instance), mirroring warp-site's own anonymous quote limit so this
    // surface can never out-hammer the public REST API. Counts tools/call only —
    // initialize / tools/list stay free (they're the discovery handshake).
    if (await isToolCall(req)) {
      const rate = await anonRateAllow(clientIp ?? "unknown");
      if (!rate.allowed) {
        return new Response(
          JSON.stringify({
            error: "rate_limited",
            error_description:
              "Anonymous limit reached (60 tool calls/hour). Sign in with a Warp account for higher limits — quotes stay free.",
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(rate.retryAfterSec),
            },
          },
        );
      }
    }
    return ctxStore.run({ ip: clientIp }, () => handler(req));
  }
  // Resolve the credential to a Warp key. OAuth access tokens are sealed + revocable;
  // a raw key (x-warp-key / Smithery config) is passed straight through.
  const at = unseal<AccessToken>(cred);
  let warpKey = cred;
  if (at && at.t === "at") {
    const base = originOf(req);
    if (at.exp <= now()) {
      // Expired token → 401 so the client refreshes. Previously this fell
      // through to raw-key passthrough (a sealed blob sent upstream as a key),
      // which surfaced as per-tool auth errors instead of a token refresh —
      // with anonymous sessions in the mix that misread would be even worse.
      return new Response(JSON.stringify({ error: "invalid_token", error_description: "Token expired." }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": `Bearer error="invalid_token", resource_metadata="${base}/.well-known/oauth-protected-resource"`,
        },
      });
    }
    if (await isRevoked(at.jti)) {
      return new Response(JSON.stringify({ error: "invalid_token", error_description: "Token has been revoked." }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": `Bearer error="invalid_token", resource_metadata="${base}/.well-known/oauth-protected-resource"`,
        },
      });
    }
    warpKey = at.key;
  }
  return ctxStore.run({ key: warpKey, ip: clientIp }, () => handler(req));
};

/** End client IP as seen by Vercel (x-forwarded-for is set by the platform;
 *  first entry is the connecting client). Used for the anonymous rate bucket
 *  and forwarded upstream for warp-site's per-IP limiter. */
function endClientIp(req: Request): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? undefined;
}

/** True if this JSON-RPC POST contains a tools/call (single or batch). Peeks a
 *  clone so the real body stream is untouched; any parse failure counts as a
 *  tool call (fail toward counting, never toward a free pass). */
async function isToolCall(req: Request): Promise<boolean> {
  if (req.method !== "POST") return false;
  try {
    const body = await req.clone().json();
    const entries = Array.isArray(body) ? body : [body];
    return entries.some((e) => e && typeof e === "object" && (e as { method?: string }).method === "tools/call");
  } catch {
    return true;
  }
}

export { withAuth as GET, withAuth as POST, withAuth as DELETE };
