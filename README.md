# warp-mcp-remote

A hosted, **remote (Streamable-HTTP)** MCP endpoint for the Warp freight API — quote, book,
and track LTL/FTL shipments from any MCP-compatible AI agent (Claude, ChatGPT, Cursor, …).

It does **not** re-implement anything: it deep-imports the **live published tools** from
[`warp-agent-mcp@0.15.0`](https://www.npmjs.com/package/warp-agent-mcp) (the same 25 tools that
ship in the local stdio server) and serves them over HTTP via Vercel's
[`mcp-handler`](https://github.com/vercel/mcp-handler). To update the tools, bump the
`warp-agent-mcp` dependency.

## How auth works (multi-tenant)

Unlike the local stdio server (one key on disk), this is shared, so **every caller brings their
own Warp API key**, scoped per-request via `AsyncLocalStorage`. The key is read from, in order:

1. `Authorization: Bearer wak_live_…`
2. `x-warp-key: wak_live_…`
3. `?warpApiKey=…` (or `?api_key=…`)
4. Smithery gateway config (`?config=<base64 JSON>` with `warpApiKey`)

Keyless quote tools work without a key; booking/tracking require one.

## Endpoint

```
https://<your-deployment>/api/mcp
```

## Deploy (Vercel)

```bash
# from this folder
npx vercel            # preview
npx vercel --prod     # production
```

Then point a domain (e.g. `mcp.wearewarp.com`) at the deployment. Optional env var:
`WARP_API_URL` (defaults to `https://www.wearewarp.com/api/v1/warp`).

## Connect a client

```jsonc
{
  "warp": {
    "url": "https://<your-deployment>/api/mcp",
    "headers": { "Authorization": "Bearer wak_live_…" }
  }
}
```

For Smithery: publish at https://smithery.ai/new with **MCP Server URL** =
`https://<your-deployment>/api/mcp` (Server ID `warp-freight`).
