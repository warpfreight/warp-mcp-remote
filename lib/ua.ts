// Distinctive User-Agent for every call this hosted connector makes to the Warp
// backend, so its traffic is attributable server-side (the MCP "door") instead
// of arriving as anonymous serverless egress. Bump the version on release.
//
// Note: the warp-agent-mcp package (which this connector wraps) defaults its own
// `warp-agent-mcp/*` UA *before* the extraHeaders() spread, so passing this
// through extraHeaders correctly overrides it — connector traffic identifies as
// warp-mcp-remote, direct npm/stdio traffic as warp-agent-mcp.
export const CONNECTOR_UA = "warp-mcp-remote/0.4.1";
