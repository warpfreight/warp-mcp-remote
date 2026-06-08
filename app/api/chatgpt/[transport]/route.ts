// ChatGPT-compliant MCP endpoint.
//
// Same Warp tools as /api/[transport], but OpenAI's Apps SDK forbids charging for
// a service inside ChatGPT. So this endpoint removes the two charging tools
// (warp_book / warp_batch_book) and replaces booking with a compliant link-out:
// `warp_book` mints a sealed checkout session and returns a short link to our
// own /checkout page where the user confirms + pays (external checkout) —
// payment happens off-ChatGPT. Everything else (quotes, tracking, reads) is the
// live published toolset, unchanged.
//
// ChatGPT connector URL:  https://mcp.wearewarp.com/api/chatgpt/mcp
import { createMcpHandler } from "mcp-handler";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import { unseal, originOf, now, type AccessToken } from "@/lib/oauth";
import { isRevoked, storeShortCheckout } from "@/lib/kv";
import crypto from "node:crypto";
import { sealCheckout, type CheckoutAddr } from "@/lib/checkout";
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

// Backward-compat shim: connectors linked before the widget was removed still
// have a cached `openai/outputTemplate` pointing at this URI, so ChatGPT fetches
// it on every warp_book call. Serve a minimal STATIC card (no script — the old
// interactive one was blocked by the sandbox anyway) so those connections don't
// hit a resource-not-found error. New connections carry no outputTemplate and
// never request it. The real action is the booking link in the tool's text.
const CHECKOUT_CARD_RESOURCE_URI = "ui://warp/checkout-card";
const checkoutCardStub = () =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
  `<body style="margin:0;font-family:-apple-system,system-ui,sans-serif">` +
  `<div style="border:1px solid rgba(127,127,127,.22);border-radius:14px;padding:16px;max-width:460px">` +
  `<div style="font-size:14px;font-weight:650">Your Warp booking is ready</div>` +
  `<div style="font-size:12.5px;opacity:.62;margin-top:5px;line-height:1.5">Open the booking link in the message to confirm the details and pay securely on Warp.</div>` +
  `</div></body></html>`;

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
      "Book a quoted Warp shipment. CALL THIS whenever the user asks to book, confirm, place, or proceed with a shipment from a quote — this tool IS the booking action. It returns a secure Warp checkout link; present that link to the user so they can confirm addresses and pay on Warp's own site (payment is completed there, not in ChatGPT). You do NOT need any additional login, payment details, or address entry to call this — only the quote_id. CRITICAL: ALWAYS pass every pickup and delivery detail the user has given you (contactName, street, city, state, zipCode, phone, email) in the pickup and delivery parameters of THIS call. The checkout page only CONFIRMS these — it does not collect them — so never defer address entry to checkout and never make the user re-enter what they already told you. Never tell the user that booking is unavailable or that you lack a connection; always call this tool and give them the link.",
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
        // Short, clean booking URL: store the sealed session in KV under a short
        // code so the model relays a tidy /b/<code> link verbatim instead of
        // swapping a 300-char opaque token for a URL it guesses. Falls back to
        // the long ?session= URL if KV is unavailable.
        let checkoutUrl = `${CHECKOUT_BASE_URL}/checkout?session=${encodeURIComponent(token)}`;
        try {
          const code = crypto.randomBytes(6).toString("base64url");
          if (await storeShortCheckout(code, token, 60 * 30)) {
            checkoutUrl = `${CHECKOUT_BASE_URL}/b/${code}`;
          }
        } catch { /* keep the long URL */ }
        const lane = params.origin_zip && params.destination_zip
          ? `${params.origin_zip} → ${params.destination_zip}`
          : "your shipment";
        return {
          content: [
            {
              type: "text",
              text:
                `Shipment ${lane} is ready to book. Present this EXACT link to the user as the booking link — do NOT replace it, shorten it, or construct any other URL (never use customer.wearewarp.com or a quote URL):\n${checkoutUrl}\n\n` +
                `This is the only valid booking link. Payment is completed on Warp; the user returns here when done.`,
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
        };
      },
    );

    // Mark warp_book safe-to-call (non-destructive: it returns a link, charges
    // nothing) so ChatGPT doesn't gate it behind an "important action" prompt.
    // No widget/outputTemplate: ChatGPT's sandbox blocks our inline-script card,
    // so the booking link is delivered as plain text (which the model relays).
    try {
      const bt = (s as { _registeredTools?: Record<string, { annotations?: Record<string, unknown>; update?: (c: Record<string, unknown>) => void }> })._registeredTools?.["warp_book"];
      if (bt) {
        const annotations = { title: "Book shipment", readOnlyHint: false, destructiveHint: false, openWorldHint: true };
        if (typeof bt.update === "function") bt.update({ annotations });
        else bt.annotations = annotations;
      }
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
    // Legacy fallback resource (see shim note above) — keeps pre-removal
    // connections from erroring on the cached outputTemplate fetch.
    s.registerResource("warp-checkout-card", CHECKOUT_CARD_RESOURCE_URI,
      { description: "Static fallback card for legacy connections.", mimeType: MCP_APP_MIME_TYPE },
      async () => ({ contents: [{ uri: CHECKOUT_CARD_RESOURCE_URI, mimeType: MCP_APP_MIME_TYPE, text: checkoutCardStub() }] }));
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
