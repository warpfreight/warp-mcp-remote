import { createMcpHandler } from "mcp-handler";
import { AsyncLocalStorage } from "node:async_hooks";
import { unseal, originOf, now, type AccessToken } from "@/lib/oauth";
import { isRevoked } from "@/lib/kv";
// Deep-import the LIVE published tool definitions (pinned to warp-agent-mcp@0.13.2).
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

// Per-request Warp API key, scoped via AsyncLocalStorage (multi-tenant).
const keyStore = new AsyncLocalStorage<string | undefined>();
const getApiKey = (): string | undefined => keyStore.getStore();

const handler = createMcpHandler(
  (server: unknown) => {
    const client = new WarpClient(WARP_API_URL, getApiKey);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = server as any;
    registerTools(s, client as any, getApiKey);
    // Widget card resources. registerTools tags each tool result with one of these
    // resource URIs; without the resources registered, the client can't fetch the card
    // HTML and shows "There was a problem displaying content from Warp". Mirrors
    // warp-agent-mcp/dist/index.js exactly — two host variants per card (text/html for
    // ChatGPT Apps, MCP_APP_MIME_TYPE for Claude MCP Apps).
    s.registerResource("warp-quote-card", QUOTE_CARD_RESOURCE_URI,
      { description: "Inline quote card after warp_van_quote / warp_box_truck_quote / warp_ftl_quote / warp_ltl_quote.", mimeType: "text/html" },
      async () => ({ contents: [{ uri: QUOTE_CARD_RESOURCE_URI, mimeType: "text/html", text: quoteCardTemplate() }] }));
    s.registerResource("warp-quote-card-mcp", QUOTE_CARD_MCP_RESOURCE_URI,
      { description: "Inline quote card (MCP Apps) after warp_van_quote / warp_box_truck_quote / warp_ftl_quote / warp_ltl_quote.", mimeType: MCP_APP_MIME_TYPE },
      async () => ({ contents: [{ uri: QUOTE_CARD_MCP_RESOURCE_URI, mimeType: MCP_APP_MIME_TYPE, text: quoteCardMcpTemplate() }] }));
    s.registerResource("warp-bookings-card", BOOKINGS_CARD_RESOURCE_URI,
      { description: "Inline shipments card after warp_list_bookings.", mimeType: "text/html" },
      async () => ({ contents: [{ uri: BOOKINGS_CARD_RESOURCE_URI, mimeType: "text/html", text: bookingsCardTemplate() }] }));
    s.registerResource("warp-bookings-card-mcp", BOOKINGS_CARD_MCP_RESOURCE_URI,
      { description: "Inline shipments card (MCP Apps) after warp_list_bookings.", mimeType: MCP_APP_MIME_TYPE },
      async () => ({ contents: [{ uri: BOOKINGS_CARD_MCP_RESOURCE_URI, mimeType: MCP_APP_MIME_TYPE, text: bookingsCardMcpTemplate() }] }));
    s.registerResource("warp-batch-quote-card", BATCH_QUOTE_CARD_RESOURCE_URI,
      { description: "Inline batch-quote card after warp_batch_quote.", mimeType: "text/html" },
      async () => ({ contents: [{ uri: BATCH_QUOTE_CARD_RESOURCE_URI, mimeType: "text/html", text: batchQuoteCardTemplate() }] }));
    s.registerResource("warp-batch-quote-card-mcp", BATCH_QUOTE_CARD_MCP_RESOURCE_URI,
      { description: "Inline batch-quote card (MCP Apps) after warp_batch_quote.", mimeType: MCP_APP_MIME_TYPE },
      async () => ({ contents: [{ uri: BATCH_QUOTE_CARD_MCP_RESOURCE_URI, mimeType: MCP_APP_MIME_TYPE, text: batchQuoteCardMcpTemplate() }] }));
    s.registerResource("warp-batch-book-card", BATCH_BOOK_CARD_RESOURCE_URI,
      { description: "Inline batch-book progress card after warp_batch_book.", mimeType: "text/html" },
      async () => ({ contents: [{ uri: BATCH_BOOK_CARD_RESOURCE_URI, mimeType: "text/html", text: batchBookCardTemplate() }] }));
    s.registerResource("warp-batch-book-card-mcp", BATCH_BOOK_CARD_MCP_RESOURCE_URI,
      { description: "Inline batch-book progress card (MCP Apps) after warp_batch_book.", mimeType: MCP_APP_MIME_TYPE },
      async () => ({ contents: [{ uri: BATCH_BOOK_CARD_MCP_RESOURCE_URI, mimeType: MCP_APP_MIME_TYPE, text: batchBookCardMcpTemplate() }] }));
  },
  { serverInfo: { name: "warp-agent-mcp", version: "0.13.2" } },
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

const withAuth = async (req: Request): Promise<Response> => {
  // Keep-warm probe (hit by a Vercel Cron every few minutes). Returns immediately,
  // but booting this instance loads the heavy MCP module at module-init, so real
  // first-calls don't pay a cold start — which otherwise exceeds Claude's tool-call
  // timeout and surfaces as "Unable to reach Warp".
  if (new URL(req.url).searchParams.get("warm") === "1") {
    return new Response("ok", { status: 200, headers: { "Cache-Control": "no-store" } });
  }
  const cred = credentialFrom(req);
  if (!cred) {
    // No credential → tell the client where to authenticate (triggers Claude's
    // "Connect / Log in to Warp" OAuth flow).
    const base = originOf(req);
    return new Response(JSON.stringify({ error: "unauthorized", error_description: "Authentication required." }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`,
      },
    });
  }
  // Resolve the credential to a Warp key. OAuth access tokens are sealed + revocable;
  // a raw key (x-warp-key / Smithery config) is passed straight through.
  const at = unseal<AccessToken>(cred);
  let warpKey = cred;
  if (at && at.t === "at" && at.exp > now()) {
    if (await isRevoked(at.jti)) {
      const base = originOf(req);
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
  return keyStore.run(warpKey, () => handler(req));
};

export { withAuth as GET, withAuth as POST, withAuth as DELETE };
