// ChatGPT-compliant MCP endpoint.
//
// Same Warp tools as /api/[transport], but OpenAI's Apps SDK forbids charging for
// a service inside ChatGPT. So this endpoint removes the two charging tools
// (warp_book / warp_batch_book) and replaces booking with a compliant link-out:
// `warp_book` mints a sealed checkout session and returns a "Confirm & Pay on
// Warp" card whose button opens our own /checkout page (external checkout) —
// payment happens off-ChatGPT. Everything else (quotes, tracking, reads) is the
// live published toolset, unchanged.
//
// ChatGPT connector URL:  https://mcp.wearewarp.com/api/chatgpt/mcp
import { createMcpHandler } from "mcp-handler";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import { unseal, originOf, now, type AccessToken } from "@/lib/oauth";
import { isRevoked } from "@/lib/kv";
import { sealCheckout, type CheckoutAddr } from "@/lib/checkout";
import { CHECKOUT_CARD_RESOURCE_URI, checkoutCardTemplate } from "@/lib/widgets/checkout-card";
// Live published tools + client (pinned to warp-agent-mcp@0.13.2). Deep imports —
// the package ships dist/*.js with no exports map / type declarations.
// @ts-ignore
import { registerTools } from "warp-agent-mcp/dist/tools.js";
// @ts-ignore
import { WarpClient } from "warp-agent-mcp/dist/client.js";
// @ts-ignore
import { QUOTE_CARD_RESOURCE_URI, QUOTE_CARD_MCP_RESOURCE_URI, MCP_APP_MIME_TYPE, quoteCardTemplate, quoteCardMcpTemplate } from "warp-agent-mcp/dist/widgets/quote-card.js";
// @ts-ignore
import { BOOKINGS_CARD_RESOURCE_URI, bookingsCardTemplate } from "warp-agent-mcp/dist/widgets/bookings-card.js";
// @ts-ignore
import { BATCH_QUOTE_CARD_RESOURCE_URI, batchQuoteCardTemplate } from "warp-agent-mcp/dist/widgets/batch-quote-card.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const WARP_API_URL = process.env.WARP_API_URL ?? "https://www.wearewarp.com/api/v1/warp";
// Public origin of this deployment (where /checkout lives). Overridable for dev.
const CHECKOUT_BASE_URL = process.env.CHECKOUT_BASE_URL ?? "https://mcp.wearewarp.com";

// Per-request Warp API key, scoped via AsyncLocalStorage (multi-tenant).
const keyStore = new AsyncLocalStorage<string | undefined>();
const getApiKey = (): string | undefined => keyStore.getStore();

const handler = createMcpHandler(
  (server: unknown) => {
    const client = new WarpClient(WARP_API_URL, getApiKey);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = server as any;

    // 1. Register the full live toolset…
    registerTools(s, client as any, getApiKey);

    // 2. …then strip the charging tools. OpenAI Apps may not take payment for a
    //    service in-chat, so warp_book / warp_batch_book (which charge Stripe
    //    up-front) must NOT be exposed here. Deleting from the SDK's tool registry
    //    removes them from tools/list. Defensive: only delete what's present.
    const reg = (s as { _registeredTools?: Record<string, unknown> })._registeredTools;
    if (reg) {
      delete reg["warp_book"];
      delete reg["warp_batch_book"];
    }

    // Anthropic-directory hint patch is irrelevant here; keep parity defensively.
    try {
      const r2 = (s as { _registeredTools?: Record<string, { annotations?: Record<string, unknown>; update?: (c: Record<string, unknown>) => void }> })._registeredTools;
      const setHint = (name: string, ann: Record<string, unknown>) => {
        const t = r2?.[name];
        if (!t) return;
        if (typeof t.update === "function") t.update({ annotations: { ...(t.annotations ?? {}), ...ann } });
        else t.annotations = { ...(t.annotations ?? {}), ...ann };
      };
      setHint("warp_login", { readOnlyHint: false });
      setHint("warp_save_load_template", { readOnlyHint: false });
    } catch { /* best-effort */ }

    // 3. Register the compliant, NON-charging booking tool. It does not move money;
    //    it mints a sealed checkout session and returns a link to our /checkout
    //    page, where the user confirms + pays on Warp (external checkout).
    s.tool(
      "warp_book",
      "Book a quoted Warp shipment. CALL THIS whenever the user asks to book, confirm, place, or proceed with a shipment from a quote — this tool IS the booking action. It returns a secure Warp checkout link; present that link to the user so they can confirm addresses and pay on Warp's own site (payment is completed there, not in ChatGPT). You do NOT need any additional login, payment details, or address entry to call this — only the quote_id. If the user has given pickup and/or delivery contact and address details, also pass them as pickup and delivery so the checkout form arrives pre-filled. Never tell the user that booking is unavailable or that you lack a connection; always call this tool and give them the link.",
      {
        quote_id: z.string().describe("Quote ID from warp_quote_id (Warp) or the id of any market option returned by a quote tool"),
        amount_usd: z.number().optional().describe("The all-in price shown on the quote (for display on the checkout card; the charge is verified server-side)"),
        origin_zip: z.string().optional().describe("Origin ZIP from the quote, for display"),
        destination_zip: z.string().optional().describe("Destination ZIP from the quote, for display"),
        mode: z.string().optional().describe("Mode label from the quote (LTL, FTL, Cargo van, 26' box truck), for display"),
        pickup_date: z.string().optional().describe("Pickup date from the quote, for display"),
        pickup: z.object({
          contactName: z.string().optional(), street: z.string().optional(), city: z.string().optional(),
          state: z.string().optional(), zipCode: z.string().optional(), phone: z.string().optional(), email: z.string().optional(),
        }).optional().describe("Pickup contact + address if the user provided it (contactName, street, city, state, zipCode, phone, email) — pre-fills the checkout form"),
        delivery: z.object({
          contactName: z.string().optional(), street: z.string().optional(), city: z.string().optional(),
          state: z.string().optional(), zipCode: z.string().optional(), phone: z.string().optional(), email: z.string().optional(),
        }).optional().describe("Delivery contact + address if the user provided it — pre-fills the checkout form"),
      },
      async (params: {
        quote_id: string;
        amount_usd?: number;
        origin_zip?: string;
        destination_zip?: string;
        mode?: string;
        pickup_date?: string;
        pickup?: CheckoutAddr;
        delivery?: CheckoutAddr;
      }) => {
        const key = getApiKey();
        if (!key) {
          return { content: [{ type: "text", text: "Not signed in. Connect your Warp account, then try again." }], isError: true };
        }
        const token = sealCheckout({
          key,
          quote_id: params.quote_id,
          amount_usd: params.amount_usd,
          mode: params.mode,
          origin_zip: params.origin_zip,
          destination_zip: params.destination_zip,
          pickup_date: params.pickup_date,
          pickup: params.pickup,
          delivery: params.delivery,
        });
        const checkoutUrl = `${CHECKOUT_BASE_URL}/checkout?session=${encodeURIComponent(token)}`;
        const lane = params.origin_zip && params.destination_zip
          ? `${params.origin_zip} → ${params.destination_zip}`
          : "your shipment";
        return {
          content: [
            {
              type: "text",
              text:
                `Your shipment (${lane}) is ready to book. Complete it securely on Warp — ` +
                `payment can't be taken inside ChatGPT, so finish here:\n${checkoutUrl}\n\n` +
                `You'll be returned to this conversation once it's booked.`,
            },
          ],
          structuredContent: {
            checkout_url: checkoutUrl,
            quote_id: params.quote_id,
            amount_usd: params.amount_usd,
            origin_zip: params.origin_zip,
            destination_zip: params.destination_zip,
            mode: params.mode,
            pickup_date: params.pickup_date,
          },
          _meta: {
            "openai/outputTemplate": CHECKOUT_CARD_RESOURCE_URI,
            ui: {
              resourceUri: CHECKOUT_CARD_RESOURCE_URI,
              // Allow the card's button to leave ChatGPT for our checkout origin.
              csp: { redirect_domains: [CHECKOUT_BASE_URL] },
            },
          },
        };
      },
    );

    // Mark warp_book as safe-to-call (non-destructive: it returns a link and
    // charges nothing) so ChatGPT doesn't gate it behind an "important action"
    // permission prompt or shy away from invoking it.
    try {
      const bt = (s as { _registeredTools?: Record<string, { annotations?: Record<string, unknown>; update?: (c: Record<string, unknown>) => void }> })._registeredTools?.["warp_book"];
      if (bt?.update) bt.update({ annotations: { title: "Book shipment", readOnlyHint: false, destructiveHint: false, openWorldHint: true } });
    } catch { /* best-effort */ }

    // 4. Widget card resources. Reuse the read/quote cards (text/html variant is
    //    the ChatGPT-facing one) + register the checkout card.
    s.registerResource("warp-quote-card", QUOTE_CARD_RESOURCE_URI,
      { description: "Inline quote card after a quote tool.", mimeType: "text/html" },
      async () => ({ contents: [{ uri: QUOTE_CARD_RESOURCE_URI, mimeType: "text/html", text: quoteCardTemplate() }] }));
    s.registerResource("warp-quote-card-mcp", QUOTE_CARD_MCP_RESOURCE_URI,
      { description: "Inline quote card (MCP Apps variant).", mimeType: MCP_APP_MIME_TYPE },
      async () => ({ contents: [{ uri: QUOTE_CARD_MCP_RESOURCE_URI, mimeType: MCP_APP_MIME_TYPE, text: quoteCardMcpTemplate() }] }));
    s.registerResource("warp-bookings-card", BOOKINGS_CARD_RESOURCE_URI,
      { description: "Inline shipments card after warp_list_bookings.", mimeType: "text/html" },
      async () => ({ contents: [{ uri: BOOKINGS_CARD_RESOURCE_URI, mimeType: "text/html", text: bookingsCardTemplate() }] }));
    s.registerResource("warp-batch-quote-card", BATCH_QUOTE_CARD_RESOURCE_URI,
      { description: "Inline batch-quote card after warp_batch_quote.", mimeType: "text/html" },
      async () => ({ contents: [{ uri: BATCH_QUOTE_CARD_RESOURCE_URI, mimeType: "text/html", text: batchQuoteCardTemplate() }] }));
    s.registerResource("warp-checkout-card", CHECKOUT_CARD_RESOURCE_URI,
      { description: "Inline 'Confirm & Pay on Warp' card after warp_book.", mimeType: "text/html" },
      async () => ({ contents: [{ uri: CHECKOUT_CARD_RESOURCE_URI, mimeType: "text/html", text: checkoutCardTemplate() }] }));
  },
  {
    serverInfo: {
      name: "warp-freight",
      version: "0.13.2",
      icons: [
        { src: "https://mcp.wearewarp.com/icon.png", mimeType: "image/png", sizes: ["512x512"] },
        { src: "https://mcp.wearewarp.com/icon.svg", mimeType: "image/svg+xml", sizes: ["any"] },
      ],
    } as unknown as { name: string; version: string },
  },
  { basePath: "/api/chatgpt", maxDuration: 60 },
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
    } catch { /* ignore */ }
  }
  return null;
}

/** Origin allowlist (DNS-rebinding protection). No Origin = server-to-server (allowed). */
function isAllowedOrigin(origin: string): boolean {
  let host: string;
  try { host = new URL(origin).hostname; } catch { return false; }
  const ok = (d: string) => host === d || host.endsWith("." + d);
  return ok("chatgpt.com") || ok("openai.com") || ok("oai.com") || ok("claude.ai") || ok("claude.com") || ok("anthropic.com") || ok("wearewarp.com") || host === "localhost" || host === "127.0.0.1";
}

const withAuth = async (req: Request): Promise<Response> => {
  if (new URL(req.url).searchParams.get("warm") === "1") {
    return new Response("ok", { status: 200, headers: { "Cache-Control": "no-store" } });
  }
  const origin = req.headers.get("origin");
  if (origin && !isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ error: "forbidden", error_description: "Origin not allowed." }), {
      status: 403, headers: { "Content-Type": "application/json" },
    });
  }
  const cred = credentialFrom(req);
  if (!cred) {
    const base = originOf(req);
    return new Response(JSON.stringify({ error: "unauthorized", error_description: "Authentication required." }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`,
      },
    });
  }
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
