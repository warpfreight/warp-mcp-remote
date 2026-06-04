import { Shell, card, muted, accent, INSTALL_GUIDE, MCP_URL } from "@/components/brand";

export const metadata = {
  title: "Warp MCP — connect your freight to Claude & ChatGPT",
  description:
    "Quote, book, and track LTL & FTL freight from any MCP-compatible AI assistant, grounded in your live Warp account.",
};

const code: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  background: "#0f1622",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#e2e8f0",
  fontSize: 13.5,
  display: "block",
  wordBreak: "break-all",
};

export default function Home() {
  return (
    <Shell>
      <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 12px" }}>
        Freight, inside your AI assistant
      </h1>
      <p style={{ color: muted, lineHeight: 1.6, fontSize: 16, margin: "0 0 32px", maxWidth: 620 }}>
        Warp&apos;s remote MCP server lets Claude, ChatGPT, and any MCP-compatible AI{" "}
        <strong style={{ color: "#e2e8f0" }}>quote, book, and track</strong> LTL &amp; FTL shipments —
        grounded in your live Warp account, not generic answers.
      </p>

      <section style={{ ...card, marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", margin: "0 0 14px" }}>
          Connect in Claude
        </h2>
        <ol style={{ color: muted, lineHeight: 1.7, margin: "0 0 16px", paddingLeft: 20 }}>
          <li>Open <strong style={{ color: "#e2e8f0" }}>Settings → Connectors → Add custom connector</strong>.</li>
          <li>Paste the endpoint URL below.</li>
          <li>Click <strong style={{ color: "#e2e8f0" }}>Connect</strong>, then sign in with your Warp account. Your password goes only to Warp — the assistant never sees it.</li>
        </ol>
        <code style={code}>{MCP_URL}</code>
        <a
          href={INSTALL_GUIDE}
          style={{
            display: "inline-block",
            marginTop: 18,
            background: accent,
            color: "#07120D",
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
            padding: "11px 18px",
            borderRadius: 9,
          }}
        >
          Full install guide — Claude Desktop, Claude Code &amp; ChatGPT →
        </a>
        <p style={{ color: "#64748b", fontSize: 12.5, margin: "12px 0 0" }}>
          New to Warp? <a href="https://www.wearewarp.com/agents/account" style={{ color: muted }}>Create an account</a> first.
        </p>
      </section>

      <section style={{ ...card, marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", margin: "0 0 12px" }}>
          What you can do
        </h2>
        <p style={{ color: muted, lineHeight: 1.7, margin: 0 }}>
          Instant quotes across <strong style={{ color: "#e2e8f0" }}>LTL, cargo van, box truck, and FTL</strong>, a
          30+ carrier price comparison, one-click booking that charges your card on file, live tracking, BOL/POD
          documents, invoices, and reusable load templates.{" "}
          <a href="/docs" style={{ color: accent, textDecoration: "none" }}>See all tools →</a>
        </p>
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", margin: "0 0 12px" }}>
          Advanced — direct API key
        </h2>
        <p style={{ color: muted, lineHeight: 1.7, margin: 0 }}>
          For programmatic or non-OAuth clients, send your Warp key as{" "}
          <code style={{ color: accent }}>Authorization: Bearer wak_live_…</code> (or{" "}
          <code style={{ color: accent }}>?warpApiKey=…</code>). Keyless quote tools work with no key at all.
        </p>
      </section>
    </Shell>
  );
}
