// Verifies the OAuth plumbing locally (everything except the real Warp login,
// which needs live credentials). Uses the same TOKEN_SECRET to mint a code.
import crypto from "node:crypto";

const SECRET = process.env.TOKEN_SECRET;
const BASE = process.env.BASE ?? "http://localhost:3213";
if (!SECRET) throw new Error("set TOKEN_SECRET");

const keyBuf = crypto.createHash("sha256").update(SECRET).digest();
const now = () => Math.floor(Date.now() / 1000);
const b64url = (b) => Buffer.from(b).toString("base64url");
function seal(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", keyBuf, iv);
  const ct = Buffer.concat([c.update(Buffer.from(JSON.stringify(obj))), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url");
}
const ok = (b) => (b ? "✓" : "✗");

const RU = "https://claude.ai/api/mcp/auth_callback";

// 1. discovery
const as = await (await fetch(`${BASE}/.well-known/oauth-authorization-server`)).json();
console.log(ok(as.authorization_endpoint?.endsWith("/authorize")), "AS metadata:", as.authorization_endpoint, "| S256:", as.code_challenge_methods_supported);
const pr = await (await fetch(`${BASE}/.well-known/oauth-protected-resource`)).json();
console.log(ok(pr.resource?.endsWith("/api/mcp")), "protected-resource:", pr.resource, "| AS:", pr.authorization_servers);

// 2. dynamic client registration
const reg = await (await fetch(`${BASE}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ redirect_uris: [RU] }) })).json();
console.log(ok(!!reg.client_id), "register → client_id len", reg.client_id?.length);
const client_id = reg.client_id;

// 3. authorize page renders
const authHtml = await (await fetch(`${BASE}/authorize?response_type=code&client_id=${encodeURIComponent(client_id)}&redirect_uri=${encodeURIComponent(RU)}&code_challenge=abc&code_challenge_method=S256&state=xyz`)).text();
console.log(ok(authHtml.includes("Sign in")), "authorize GET renders login page");

// reject bad redirect_uri
const bad = await fetch(`${BASE}/authorize?response_type=code&client_id=${encodeURIComponent(client_id)}&redirect_uri=https://evil.example/x&code_challenge=abc&code_challenge_method=S256`);
console.log(ok(bad.status === 400), "authorize rejects unregistered redirect_uri →", bad.status);

// 4. PKCE token exchange (simulate the code a successful login would mint)
const verifier = b64url(crypto.randomBytes(32));
const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
const code = seal({ t: "code", key: "wak_test_DUMMY", cc: challenge, ru: RU, ci: client_id, exp: now() + 300 });
const tok = await (await fetch(`${BASE}/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: RU, client_id }) })).json();
console.log(ok(!!tok.access_token), "token exchange (PKCE S256) → access_token", tok.token_type, tok.expires_in);

// wrong verifier rejected
const tok2 = await fetch(`${BASE}/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grant_type: "authorization_code", code, code_verifier: "wrong", redirect_uri: RU, client_id }) });
console.log(ok(tok2.status === 400), "token rejects bad PKCE verifier →", tok2.status);

// 5. MCP requires auth
const noAuth = await fetch(`${BASE}/api/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "v", version: "1" } } }) });
console.log(ok(noAuth.status === 401 && !!noAuth.headers.get("www-authenticate")), "MCP no-auth → 401 +", noAuth.headers.get("www-authenticate")?.slice(0, 40));

// 6. MCP accepts the issued OAuth token
const authed = await (await fetch(`${BASE}/api/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${tok.access_token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "v", version: "1" } } }) })).text();
console.log(ok(authed.includes("serverInfo") && authed.includes("warp-agent-mcp")), "MCP accepts OAuth token → initialize ok");
