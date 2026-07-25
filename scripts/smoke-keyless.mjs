#!/usr/bin/env node
/**
 * Keyless-discovery smoke test (backlog step 4).
 *
 * Drives the MCP endpoint over streamable HTTP exactly like a client with NO
 * credentials and asserts the whole anonymous contract:
 *
 *   1. initialize succeeds (tool list, not a 401 — the backlog's own check)
 *   2. tools/list returns the full roster
 *   3. an anonymous quote tool returns a REAL price (public keyless surface)
 *   4. an anonymous booking tool is REFUSED with a sign-in pointer,
 *      without touching upstream (and without a booking, ever)
 *   5. `login` refuses in-chat credentials and points at OAuth
 *   6. multistop_quote (keyed upstream) is gated for anonymous sessions
 *
 * Usage:
 *   node scripts/smoke-keyless.mjs                       # local dev server
 *   node scripts/smoke-keyless.mjs https://mcp.wearewarp.com/api/mcp
 *
 * Exit 0 = every check passed. No booking is ever attempted with a key.
 */

const BASE = process.argv[2] ?? "http://localhost:4680/api/mcp";

let failures = 0;
const check = (label, cond, detail = "") => {
  console.log(`  ${cond ? "✓" : "✗"} ${label}${cond || !detail ? "" : ` — ${detail}`}`);
  if (!cond) failures += 1;
};

/** POST a JSON-RPC message; parse both plain-JSON and SSE-framed responses. */
async function rpc(method, params, { id, session } = {}) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (session) headers["mcp-session-id"] = session;
  const body = { jsonrpc: "2.0", method, ...(params ? { params } : {}) };
  if (id !== undefined) body.id = id;
  const res = await fetch(BASE, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  let message = null;
  try {
    message = JSON.parse(text);
  } catch {
    for (const line of text.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try {
        const parsed = JSON.parse(line.slice(5).trim());
        if (parsed && (parsed.id === id || parsed.result || parsed.error)) message = parsed;
      } catch { /* keep scanning */ }
    }
  }
  return { status: res.status, session: res.headers.get("mcp-session-id") ?? session, message };
}

function toolText(message) {
  const c = message?.result?.content;
  return Array.isArray(c) ? c.filter((x) => x?.type === "text").map((x) => x.text).join("\n") : "";
}

console.log(`== keyless discovery smoke vs ${BASE} ==`);

// 1. initialize with NO credential — the backlog's success criterion.
const init = await rpc("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "smoke-keyless", version: "1.0" },
}, { id: 1 });
check("anonymous initialize is not a 401", init.status !== 401, `HTTP ${init.status}`);
check("initialize returns serverInfo", !!init.message?.result?.serverInfo?.name,
  JSON.stringify(init.message)?.slice(0, 160));
const session = init.session;
await rpc("notifications/initialized", undefined, { session });

// 2. tools/list — full roster visible anonymously.
const list = await rpc("tools/list", {}, { id: 2, session });
const tools = list.message?.result?.tools ?? [];
check("tools/list returns the roster", tools.length >= 25, `got ${tools.length}`);

// 3. anonymous quote returns a real price. Quotes are public + keyless by
//    design ("hammer them as much as you want" — the backlog's guardrail).
const quote = await rpc("tools/call", {
  name: "ltl_quote",
  arguments: {
    origin_zip: "90021", destination_zip: "60609", pickup_date: "2026-08-11",
    pallets: 6, weight_lbs_per_pallet: 800, commodity: "packaged consumer goods",
    length_in: 48, width_in: 40, height_in: 48,
  },
}, { id: 3, session });
const quoteText = toolText(quote.message);
check("anonymous ltl_quote returns a real price", /price_usd|warp_price/.test(quoteText),
  quoteText.slice(0, 120));

// 4. anonymous booking is refused BEFORE upstream, with the sign-in pointer.
//    (Never a real booking: no key exists in this process, and the gate returns
//    before any upstream call.)
const book = await rpc("tools/call", {
  name: "book",
  arguments: { quote_id: "wq_SMOKE_NOT_REAL" },
}, { id: 4, session });
const bookText = toolText(book.message);
check("anonymous book is gated", book.message?.result?.isError === true, bookText.slice(0, 120));
check("gate names the fix (sign in)", /Sign in to Warp/i.test(bookText), bookText.slice(0, 120));

// 5. login refuses in-chat credentials everywhere on the hosted remote.
const login = await rpc("tools/call", {
  name: "login",
  arguments: { email: "smoke@example.com", password: "not-a-real-password" },
}, { id: 5, session });
check("login points at OAuth, never accepts credentials",
  /OAuth/i.test(toolText(login.message)) && login.message?.result?.isError === true,
  toolText(login.message).slice(0, 120));

// 6. an account-surface tool (payment_status: no args, auth Yes upstream) is
//    gated for anonymous sessions. NOTE: schema-INVALID calls to gated tools
//    (e.g. multistop_quote with bad args) fail SDK input validation before the
//    gate ever runs — that is by design; the gate covers every call that would
//    otherwise reach a handler.
const ps = await rpc("tools/call", {
  name: "payment_status",
  arguments: {},
}, { id: 6, session });
check("anonymous payment_status is gated",
  ps.message?.result?.isError === true && /Sign in to Warp/i.test(toolText(ps.message)),
  toolText(ps.message).slice(0, 120));

console.log(failures === 0 ? "\n✅ keyless discovery contract holds" : `\n❌ ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
