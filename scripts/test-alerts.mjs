// Offline test for lib/alerts.ts: never posts to Slack (fetch is stubbed and the
// real webhook env is never read). Run: node scripts/test-alerts.mjs
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

const src = readFileSync(new URL("../lib/alerts.ts", import.meta.url), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const dir = mkdtempSync(join(tmpdir(), "alerts-"));
writeFileSync(join(dir, "alerts.mjs"), js);
const { clientName, isAlertableFailure, connectorAlertText, notifyConnector } = await import(join(dir, "alerts.mjs"));
let n = 0; const ok = (m) => console.log(`  ok ${++n} ${m}`);

assert.equal(clientName("https://claude.ai/api/mcp/auth_callback"), "Claude");
assert.equal(clientName("https://chatgpt.com/connector_platform_oauth_redirect"), "ChatGPT");
assert.equal(clientName("https://www.perplexity.ai/cb"), "Perplexity");
assert.equal(clientName("http://localhost:6274/oauth/callback"), "local");
assert.equal(clientName("not a url"), "unknown");
ok("client named from the redirect URI");

assert.equal(isAlertableFailure("Invalid email or password."), false);
assert.equal(isAlertableFailure("Enter your email and password."), false);
assert.equal(isAlertableFailure("We couldn't finish setting up your account. Email support@wearewarp.com and our team will get you in fast."), true);
assert.equal(isAlertableFailure("Could not reach the Warp login service. Try again."), true);
ok("wrong passwords are quiet; setup failures alert");

const at = new Date("2026-10-10T22:30:00Z");
const t1 = connectorAlertText({ kind: "signed_in", email: "pat@highstock.com", agentId: "ag_X", hasCard: false, client: "Claude" }, at);
assert.match(t1, /customer signed in/); assert.match(t1, /pat@highstock\.com \(ag_X\)/); assert.match(t1, /Assistant: Claude/); assert.match(t1, /Card on file: no/); assert.match(t1, /Oct 10, 3:30 PM PT/);
const t2 = connectorAlertText({ kind: "new_account", email: "new@co.com", agentId: "ag_Y", client: "ChatGPT" }, at);
assert.match(t2, /new account created/); assert.match(t2, /Assistant: ChatGPT/);
const t3 = connectorAlertText({ kind: "sign_in_failed", email: "pat@highstock.com", error: "We couldn't finish setting up your account.", client: "Claude" }, at);
assert.match(t3, /sign-in failed/); assert.match(t3, /Shown to the customer: We couldn't finish/);
for (const t of [t1, t2, t3]) assert.ok(!/—/.test(t), "no em dashes");
ok("message text for all three events");

const realFetch = globalThis.fetch; let calls = [];
globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response("ok"); };
delete process.env.CONNECTOR_SLACK_WEBHOOK_URL;
await notifyConnector({ kind: "signed_in", email: "pat@highstock.com", client: "Claude" });
assert.equal(calls.length, 0);
ok("no webhook set: nothing is sent");

process.env.CONNECTOR_SLACK_WEBHOOK_URL = "https://hooks.example.invalid/T/B/X";
await notifyConnector({ kind: "signed_in", email: "e2e@example.com", client: "Claude" });
assert.equal(calls.length, 0);
ok("@example.com test addresses are never sent");

await notifyConnector({ kind: "signed_in", email: "pat@highstock.com", agentId: "ag_X", hasCard: true, client: "Claude" });
assert.equal(calls.length, 1); assert.equal(calls[0].url, "https://hooks.example.invalid/T/B/X");
assert.equal(calls[0].init.method, "POST"); assert.match(JSON.parse(calls[0].init.body).text, /pat@highstock\.com/);
ok("real sign-in posts one message to the webhook");

globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
await notifyConnector({ kind: "new_account", email: "new@co.com", client: "Claude" });
ok("a Slack outage never throws into the sign-in");

globalThis.fetch = realFetch; delete process.env.CONNECTOR_SLACK_WEBHOOK_URL;
console.log(`alerts: ${n}/${n} ok`);
