import { Shell, MCP_URL } from "@/components/brand";
import StarterPrompts from "@/components/starter-prompts";
import DitherBg from "@/components/dither-bg";

export const metadata = {
  title: "Warp freight starter kit | Templates and prompts",
  description: "Use your assistant’s connected apps or a shipment workbook to find upcoming freight, compare Warp quotes, check invoices and review service.",
};

export default function StarterKit() {
  return (
    <Shell>
      <DitherBg />
      <div className="starter-hero">
        <span className="eyebrow">The freight starter kit</span>
        <h1 className="h1">Start with your shipments.<br />Not a blank prompt.</h1>
        <p className="lead">Start with orders in your assistant’s connected apps, a purchase order or a shipment sheet. Find freight options that fit your deadlines and budget.</p>
        <a className="btn" href="/downloads/warp-shipment-intake.xlsx" download>Download the Excel template <span aria-hidden="true">↓</span></a>
        <p className="starter-download-note">50 shipment rows · Editable pickup locations · Results tab · No macros</p>
      </div>

      <ol className="starter-steps">
        <li><span>01</span><h2>Connect Warp once</h2><p>Add Warp to your MCP-compatible assistant. In the Connect flow, create a Warp account if you don&apos;t have one. You can skip adding a card for quotes.</p><a className="link" href="/docs">Connection instructions →</a></li>
        <li><span>02</span><h2>Choose where to start</h2><p>Already connected an order or email app to your assistant? Ask it to use those records. Otherwise, upload a PO or use the shipment template. Your assistant will ask for any missing freight details.</p></li>
        <li><span>03</span><h2>Copy a prompt below</h2><p>Start with “Find freight opportunities in my connected apps,” or pick a file-based task. Review the recommendations, then choose a shipment to discuss booking.</p></li>
      </ol>

      <section aria-labelledby="tasks-title">
        <span className="eyebrow">Choose the work you need done</span>
        <h2 id="tasks-title" className="h2" style={{ margin: "12px 0 24px" }}>Quotes, costs and service. One clear starting point.</h2>
        <StarterPrompts />
      </section>

      <section className="starter-notes" aria-label="What to expect">
        <div><h2>What comes back</h2><p>Quote prompts request options linked to your shipment IDs. Invoice prompts request findings linked to your source documents. Your assistant can return a table or CSV if it cannot edit Excel files.</p></div>
        <div><h2>Know what you are comparing</h2><p>Carrier marketplace comparisons are for LTL. FTL returns a Warp rate. A new quote compared with an old invoice is a potential cost opportunity, not realized savings. Service quality needs delivery evidence.</p></div>
        <div><h2>You stay in control</h2><p>These prompts start with quotes or review. The connected-app prompt asks for explicit approval of the shipment, price and details before booking; the file-based prompts remain quote or review only. They do not authorize messages, payment changes or recurring work. These instructions do not replace your assistant&apos;s approval controls.</p></div>
      </section>
      <details className="starter-connection"><summary>Need the connector address?</summary><code className="codebox">{MCP_URL}</code><p className="muted">Warp provides the freight tools. Access to Shopify, email or other sources comes from your assistant’s separately connected apps and their permissions. Availability varies by assistant and plan. Connecting Warp does not grant access to those apps or start background monitoring.</p></details>
    </Shell>
  );
}
