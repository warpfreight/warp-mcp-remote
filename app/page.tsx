import { Shell, INSTALL_GUIDE, MCP_URL } from "@/components/brand";

export const metadata = {
  title: "Warp MCP — freight inside your AI assistant",
  description:
    "Quote, book, and track LTL & FTL freight from Claude, ChatGPT, or any MCP-compatible AI — grounded in your live Warp account.",
};

const STATS: [string, string][] = [
  ["23", "tools"],
  ["4", "freight modes"],
  ["30+", "carriers compared"],
];

export default function Home() {
  return (
    <Shell>
      <div style={{ maxWidth: 660 }}>
        <span className="eyebrow"><span className="livedot" /> Live · Streamable-HTTP MCP</span>
        <h1 className="h1" style={{ margin: "18px 0 20px" }}>Freight, inside your AI assistant</h1>
        <p className="lead" style={{ margin: 0 }}>
          Warp&apos;s remote MCP server lets Claude, ChatGPT, and any MCP-compatible AI{" "}
          <span style={{ color: "var(--text)", fontWeight: 600 }}>quote, book, and track</span> LTL &amp; FTL
          shipments — grounded in your live Warp account, not generic answers.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 30, flexWrap: "wrap" }}>
          <a className="btn" href={INSTALL_GUIDE}>Install guide →</a>
          <a className="btn btn-ghost" href="/docs">Browse the tools</a>
        </div>
      </div>

      <div style={{ display: "flex", gap: 52, margin: "60px 0 56px", flexWrap: "wrap" }}>
        {STATS.map(([n, l]) => (
          <div key={l}>
            <div className="stat-num">{n}</div>
            <div className="stat-label">{l}</div>
          </div>
        ))}
      </div>

      <section className="card" style={{ padding: 28, marginBottom: 16 }}>
        <span className="label">Connect in Claude</span>
        <ol className="muted" style={{ lineHeight: 1.75, margin: "16px 0 18px", paddingLeft: 20, fontSize: 15 }}>
          <li>Open <b style={{ color: "var(--text)" }}>Settings → Connectors → Add custom connector</b>.</li>
          <li>Paste the endpoint URL below.</li>
          <li>Click <b style={{ color: "var(--text)" }}>Connect</b>, then sign in with Warp. Your password goes only to Warp — the assistant never sees it.</li>
        </ol>
        <code className="codebox">{MCP_URL}</code>
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <a className="btn" href={INSTALL_GUIDE}>Full install guide — Desktop · Code · ChatGPT →</a>
          <span className="muted" style={{ fontSize: 13 }}>
            New to Warp? <a className="link" href="https://www.wearewarp.com/agents/account">Create an account</a>
          </span>
        </div>
      </section>

      <section className="card" style={{ padding: 28, marginBottom: 16 }}>
        <span className="label">What you can do</span>
        <p className="muted" style={{ lineHeight: 1.75, margin: "16px 0 0", fontSize: 15 }}>
          Instant quotes across <b style={{ color: "var(--text)" }}>LTL, cargo van, box truck, and FTL</b>, a 30+
          carrier price comparison, one-click booking that charges your card on file, live tracking, BOL/POD
          documents, invoices, and reusable load templates. <a className="link" href="/docs">See all tools →</a>
        </p>
      </section>

      <section className="card" style={{ padding: 28 }}>
        <span className="label">Advanced — direct API key</span>
        <p className="muted" style={{ lineHeight: 1.75, margin: "16px 0 0", fontSize: 15 }}>
          For programmatic or non-OAuth clients, send your Warp key as{" "}
          <code className="inline">Authorization: Bearer wak_live_…</code> (or <code className="inline">?warpApiKey=…</code>).
          Keyless quote tools work with no key at all.
        </p>
      </section>
    </Shell>
  );
}
