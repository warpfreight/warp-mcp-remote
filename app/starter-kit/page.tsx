import { Shell, MCP_URL } from "@/components/brand";
import StarterPrompts from "@/components/starter-prompts";

export const metadata = {
  title: "Warp freight starter kit | Templates and prompts",
  description: "Download a shipment intake workbook and copy prompts for freight quotes, invoice checks, cost comparisons and service reviews with Warp MCP.",
};

export default function StarterKit() {
  return (
    <Shell>
      <div className="starter-hero">
        <span className="eyebrow">The freight starter kit</span>
        <h1 className="h1">Start with your shipments.<br />Not a blank prompt.</h1>
        <p className="lead">Fill in a sheet. Attach your files. Ask Warp to compare freight options or help review what you paid and how it went.</p>
        <a className="btn" href="/downloads/warp-shipment-intake.xlsx" download>Download the Excel template <span aria-hidden="true">↓</span></a>
        <p className="starter-download-note">50 shipment rows · Editable pickup locations · Results tab · No macros</p>
      </div>

      <ol className="starter-steps">
        <li><span>01</span><h2>Connect Warp once</h2><p>Add Warp to your MCP-compatible assistant. In the Connect flow, create a Warp account if you don&apos;t have one. You can skip adding a card for quotes.</p><a className="link" href="/docs">Connection instructions →</a></li>
        <li><span>02</span><h2>Bring your details</h2><p>For quotes, fill in Instructions and Intake in the workbook. For billing or service reviews, attach your invoices, original quotes and delivery records.</p></li>
        <li><span>03</span><h2>Copy a prompt below</h2><p>Paste it into your assistant with the files attached. Review the options, evidence and missing details before deciding what to do next.</p></li>
      </ol>

      <section aria-labelledby="tasks-title">
        <span className="eyebrow">Choose the work you need done</span>
        <h2 id="tasks-title" className="h2" style={{ margin: "12px 0 24px" }}>Quotes, costs and service. One clear starting point.</h2>
        <StarterPrompts />
      </section>

      <section className="starter-notes" aria-label="What to expect">
        <div><h2>What comes back</h2><p>Quote prompts request options linked to your shipment IDs. Invoice prompts request findings linked to your source documents. Your assistant can return a table or CSV if it cannot edit Excel files.</p></div>
        <div><h2>Know what you are comparing</h2><p>Carrier marketplace comparisons are for LTL. FTL returns a Warp rate. A new quote compared with an old invoice is a potential cost opportunity, not realized savings. Service quality needs delivery evidence.</p></div>
        <div><h2>You stay in control</h2><p>Every prompt here is for quotes or review only. They ask the assistant not to book, send messages or change payment settings. These instructions do not replace your assistant&apos;s approval controls.</p></div>
      </section>
      <details className="starter-connection"><summary>Need the connector address?</summary><code className="codebox">{MCP_URL}</code><p className="muted">Use the same template and prompts with an assistant that supports the Warp connector and file uploads. File editing and task scheduling depend on your assistant.</p></details>
    </Shell>
  );
}
