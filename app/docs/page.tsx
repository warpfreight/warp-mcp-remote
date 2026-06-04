import { Shell, card, muted, accent, INSTALL_GUIDE, MCP_URL } from "@/components/brand";

export const metadata = {
  title: "Warp MCP — Docs & tool reference",
  description: "How to connect the Warp MCP server and the full list of tools it exposes.",
};

const GROUPS: { title: string; tools: [string, string][] }[] = [
  {
    title: "Quoting",
    tools: [
      ["warp_ltl_quote", "All-inclusive LTL rate for a lane, with a live quote card."],
      ["warp_ltl_market_options", "Compare 30+ LTL carriers, ranked by price."],
      ["warp_van_quote", "Cargo van quote (1–3 pallets, firm price)."],
      ["warp_box_truck_quote", "26′ box truck quote (1–12 pallets)."],
      ["warp_ftl_quote", "Full truckload (53′ dry van) quote."],
      ["warp_batch_quote", "Price many lanes in one call (spreadsheets / CSVs)."],
    ],
  },
  {
    title: "Booking",
    tools: [
      ["warp_book", "Book a quoted shipment. Charges the card on file at Warp."],
      ["warp_batch_book", "Book several quoted lanes in one call."],
    ],
  },
  {
    title: "Tracking & shipments",
    tools: [
      ["warp_track", "Track a shipment by ID or number."],
      ["warp_events", "Full tracking-event timeline for a shipment."],
      ["warp_list_bookings", "List your recent bookings."],
      ["warp_get_documents", "Shipment documents (BOL, POD) with download links."],
      ["warp_get_invoice", "Invoice for a delivered shipment."],
    ],
  },
  {
    title: "Account & history",
    tools: [
      ["warp_status", "API health check + validates your key."],
      ["warp_payment_status", "Whether a card is on file (brand + last 4 only)."],
      ["warp_quote_history", "Your recent quotes."],
      ["warp_lane_history", "Shipping history for your lanes."],
      ["warp_locations", "Saved pickup / delivery addresses."],
      ["warp_analytics", "Bookings and revenue analytics."],
    ],
  },
  {
    title: "Load templates",
    tools: [
      ["warp_save_load_template", "Save a reusable shipment config."],
      ["warp_load_templates", "List saved templates."],
      ["warp_delete_load_template", "Delete a template."],
    ],
  },
];

const codeInline: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  color: accent,
  fontSize: 13,
};

export default function Docs() {
  return (
    <Shell>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 12px" }}>Documentation</h1>
      <p style={{ color: muted, lineHeight: 1.6, margin: "0 0 32px", maxWidth: 640 }}>
        A Streamable-HTTP MCP server for the Warp freight platform. Connect it once and your AI assistant can quote,
        book, and manage real shipments on your Warp account.
      </p>

      <section style={{ ...card, marginBottom: 24 }}>
        <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", margin: "0 0 12px" }}>Connect</h2>
        <p style={{ color: muted, lineHeight: 1.7, margin: "0 0 10px" }}>
          Add a custom connector pointing at <code style={codeInline}>{MCP_URL}</code>, click Connect, and sign in with
          your Warp account (OAuth 2.1 + PKCE). The assistant receives an opaque, encrypted token — never your password
          or raw key.
        </p>
        <p style={{ color: muted, lineHeight: 1.7, margin: 0 }}>
          Step-by-step for Claude Desktop, Claude Code, and ChatGPT:{" "}
          <a href={INSTALL_GUIDE} style={{ color: accent, textDecoration: "none" }}>install guide ↗</a>
        </p>
      </section>

      <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", margin: "0 0 16px" }}>
        Tools
      </h2>
      {GROUPS.map((g) => (
        <div key={g.title} style={{ marginBottom: 22 }}>
          <h3 style={{ fontSize: 15, fontWeight: 650, margin: "0 0 10px", color: "#e2e8f0" }}>{g.title}</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {g.tools.map(([name, desc]) => (
              <div key={name} style={{ ...card, padding: "12px 14px", display: "grid", gridTemplateColumns: "minmax(190px, 230px) 1fr", gap: 12, alignItems: "baseline" }}>
                <code style={{ ...codeInline, fontSize: 13.5 }}>{name}</code>
                <span style={{ color: muted, fontSize: 13.5, lineHeight: 1.5 }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <section style={{ ...card, marginTop: 12 }}>
        <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", margin: "0 0 12px" }}>
          Authentication & data
        </h2>
        <p style={{ color: muted, lineHeight: 1.7, margin: 0 }}>
          Authentication is handled entirely by the Connect flow — no separate login tool. Tool results are returned only
          to the AI client you authorized. See the{" "}
          <a href="/privacy" style={{ color: accent, textDecoration: "none" }}>privacy policy</a> for exactly what is
          accessed and stored.
        </p>
      </section>
    </Shell>
  );
}
