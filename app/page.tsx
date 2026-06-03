export default function Home() {
  return (
    <main
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: 680,
        margin: "0 auto",
        padding: "64px 24px",
        color: "#e2e8f0",
        background: "#141c2b",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>Warp MCP — remote endpoint</h1>
      <p style={{ color: "#94a3b8", lineHeight: 1.6 }}>
        Streamable-HTTP MCP server for the Warp freight API — quote, book, and track LTL/FTL
        shipments from any MCP-compatible AI agent. Wraps the live <code>warp-agent-mcp</code> tools.
      </p>
      <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginTop: 32 }}>
        Connect
      </h2>
      <p style={{ color: "#94a3b8", lineHeight: 1.6 }}>
        Endpoint: <code style={{ color: "#4ade80" }}>/api/mcp</code>
        <br />
        Auth: send your Warp API key as <code>Authorization: Bearer wak_live_…</code> (or{" "}
        <code>?warpApiKey=…</code>). Keyless quote tools work without a key.
      </p>
    </main>
  );
}
