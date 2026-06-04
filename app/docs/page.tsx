import { Shell, INSTALL_GUIDE, MCP_URL } from "@/components/brand";

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

export default function Docs() {
  return (
    <Shell>
      <h1 className="h1" style={{ fontSize: 42, margin: "0 0 16px" }}>Documentation</h1>
      <p className="lead" style={{ maxWidth: 640, margin: "0 0 44px" }}>
        A Streamable-HTTP MCP server for the Warp freight platform. Connect it once and your AI assistant can quote,
        book, and manage real shipments on your Warp account.
      </p>

      <section className="card" style={{ padding: 28, marginBottom: 40 }}>
        <span className="label">Connect</span>
        <p className="muted" style={{ lineHeight: 1.75, margin: "16px 0 10px", fontSize: 15 }}>
          Add a custom connector pointing at <code className="inline">{MCP_URL}</code>, click Connect, and sign in with
          your Warp account (OAuth 2.1 + PKCE). The assistant receives an opaque, encrypted token — never your password
          or raw key.
        </p>
        <p className="muted" style={{ margin: 0, fontSize: 15 }}>
          Step-by-step for Claude Desktop, Claude Code, and ChatGPT:{" "}
          <a className="link" href={INSTALL_GUIDE}>install guide ↗</a>
        </p>
      </section>

      <span className="label">Tools</span>
      <div style={{ marginTop: 18 }}>
        {GROUPS.map((g) => (
          <div key={g.title} style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".07em" }}>
              {g.title}
            </h3>
            <div className="card">
              {g.tools.map(([name, desc]) => (
                <div key={name} className="toolrow">
                  <code className="inline" style={{ fontSize: 13.5 }}>{name}</code>
                  <span className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <section className="card" style={{ padding: 28, marginTop: 12 }}>
        <span className="label">Authentication &amp; data</span>
        <p className="muted" style={{ lineHeight: 1.75, margin: "16px 0 0", fontSize: 15 }}>
          Authentication is handled entirely by the Connect flow — there is no separate login tool. Tool results are
          returned only to the AI client you authorized. See the <a className="link" href="/privacy">privacy policy</a> for
          exactly what is accessed and stored.
        </p>
      </section>
    </Shell>
  );
}
