import { createMcpHandler } from "mcp-handler";
import { AsyncLocalStorage } from "node:async_hooks";
// Deep-import the LIVE published tool definitions (pinned to warp-agent-mcp@0.13.2).
// No vendoring — bump the dependency to pick up new tool versions.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — package ships dist/*.js without type declarations
import { registerTools } from "warp-agent-mcp/dist/tools.js";
// @ts-ignore
import { WarpClient } from "warp-agent-mcp/dist/client.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const WARP_API_URL = process.env.WARP_API_URL ?? "https://www.wearewarp.com/api/v1/warp";

// This is a MULTI-TENANT remote: every caller brings their own Warp API key, scoped
// to the request via AsyncLocalStorage. We never read a key from disk/env at runtime.
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

/** Pull the caller's Warp key from common locations (header, query, Smithery config). */
function extractKey(req: Request): string | undefined {
  const auth = req.headers.get("authorization");
  if (auth && /^bearer\s+/i.test(auth)) {
    const k = auth.replace(/^bearer\s+/i, "").trim();
    if (k) return k;
  }
  const xkey = req.headers.get("x-warp-key");
  if (xkey) return xkey.trim();

  const url = new URL(req.url);
  const q = url.searchParams.get("warpApiKey") || url.searchParams.get("api_key");
  if (q) return q.trim();

  // Smithery's gateway forwards user config as base64 JSON in ?config=
  const cfg = url.searchParams.get("config");
  if (cfg) {
    try {
      const obj = JSON.parse(Buffer.from(cfg, "base64").toString("utf8"));
      if (obj && typeof obj.warpApiKey === "string" && obj.warpApiKey) return obj.warpApiKey;
    } catch {
      /* ignore malformed config */
    }
  }
  return undefined;
}

const withKey = (req: Request) => keyStore.run(extractKey(req), () => handler(req));

export { withKey as GET, withKey as POST, withKey as DELETE };
