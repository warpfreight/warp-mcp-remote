import { createMcpHandler } from "mcp-handler";
import { AsyncLocalStorage } from "node:async_hooks";
import { unseal, originOf, now, type AccessToken } from "@/lib/oauth";
// Deep-import the LIVE published tool definitions (pinned to warp-agent-mcp@0.13.2).
// No vendoring — bump the dependency to pick up new tool versions.
// @ts-ignore — package ships dist/*.js without type declarations
import { registerTools } from "warp-agent-mcp/dist/tools.js";
// @ts-ignore
import { WarpClient } from "warp-agent-mcp/dist/client.js";

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
    registerTools(server as any, client as any, getApiKey);
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

/** Resolve to a Warp API key: OAuth access token → embedded key; else treat as raw key. */
function warpKeyFrom(cred: string): string {
  const at = unseal<AccessToken>(cred);
  if (at && at.t === "at" && at.exp > now()) return at.key;
  return cred;
}

const withAuth = (req: Request): Response | Promise<Response> => {
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
  return keyStore.run(warpKeyFrom(cred), () => handler(req));
};

export { withAuth as GET, withAuth as POST, withAuth as DELETE };
