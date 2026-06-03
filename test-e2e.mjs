// End-to-end test against the live remote MCP, using a real MCP client.
// Usage:  node test-e2e.mjs                 (keyless — quotes only)
//         WARP_KEY=wak_live_… node test-e2e.mjs   (also exercises authed reads)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const ENDPOINT = process.env.MCP_URL ?? "https://warp-mcp-remote.vercel.app/api/mcp";
const KEY = process.env.WARP_KEY;

const textOf = (res) =>
  (res?.content ?? []).map((c) => (c.type === "text" ? c.text : `[${c.type}]`)).join("\n");

const transport = new StreamableHTTPClientTransport(new URL(ENDPOINT), {
  requestInit: KEY ? { headers: { Authorization: `Bearer ${KEY}` } } : undefined,
});
const client = new Client({ name: "warp-e2e", version: "1.0.0" });
await client.connect(transport);
console.log(`✓ connected: ${ENDPOINT} ${KEY ? "(with key)" : "(keyless)"}`);

const { tools } = await client.listTools();
console.log(`✓ tools/list → ${tools.length} tools`);
console.log("  " + tools.map((t) => t.name).join(", "));

async function call(name, args) {
  console.log(`\n▶ ${name}(${JSON.stringify(args)})`);
  try {
    const res = await client.callTool({ name, arguments: args });
    const t = textOf(res).replace(/\n/g, "\n  ");
    console.log((res.isError ? "  ✗ " : "  ✓ ") + t.slice(0, 700));
  } catch (e) {
    console.log("  ✗ threw: " + e.message);
  }
}

// Keyless quotes (the full pipeline: remote → WarpClient → Warp REST → result)
await call("warp_van_quote", { origin_zip: "90001", destination_zip: "85001", pallets: 2, weight_lbs_per_pallet: 1000, pickup_date: "2026-06-10", commodity: "general freight" });
await call("warp_ltl_quote", { origin_zip: "90001", destination_zip: "60601", pickup_date: "2026-06-10", pallets: 4, weight_lbs_per_pallet: 800, commodity: "general freight", length_in: 48, width_in: 40, height_in: 48 });
await call("warp_ltl_market_options", { origin_zip: "90001", destination_zip: "60601", pickup_date: "2026-06-10", pallets: 4, weight_lbs_per_pallet: 800, commodity: "general freight", length_in: 48, width_in: 40, height_in: 48 });
// Authed read (no booking) — confirms the auth path; graceful if keyless
await call("warp_status", {});

await client.close();
console.log("\n✓ done");
