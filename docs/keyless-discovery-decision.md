# Keyless discovery on mcp.wearewarp.com — decision brief (backlog step 4)

For Troy. The recommendation from your backlog is implemented on this branch and
verified locally; nothing is deployed. This is the abuse analysis you asked for,
plus one UX unknown we should test on a real Claude connector before calling it
done.

## What changes

| Surface | Before | After |
| --- | --- | --- |
| `initialize` / `tools/list`, no credential | 401 | Works — a stranger can add the connector and see the tools |
| Quote tools, no credential (`compare_modes`, `ltl_quote`, `ftl_quote`, `van_quote`, `box_truck_quote`, `ltl_market_options`, `batch_quote`, `status`) | 401 | Work — same public keyless surface as the REST API |
| Everything else, no credential (booking, tracking, documents, invoices, account, `multistop_quote`) | 401 | Instant per-tool refusal that names the fix (sign in / create account), **no upstream call** |
| `login` (in-chat email+password) | Ran against upstream auth | Refused for **every** session — the hosted connector is OAuth-only; passwords must never transit a multi-tenant lambda |
| Any credentialed session | unchanged | unchanged (verified: keyed calls pass the gate to the real handlers) |
| Expired OAuth token | silently degraded to garbage-key passthrough | proper `401 invalid_token` so clients refresh |

The anonymous tool list is exactly the set that is public and keyless on
www.wearewarp.com already — this opens **zero** new capability; it removes a
login wall in front of capability that is deliberately free.

## Abuse analysis

1. **Quota exhaustion upstream (the real one).** warp-site's keyless limiter
   (`src/lib/quoteRateLimit.ts`) allows **60/hr per IP**, keyed on the first
   `x-forwarded-for` entry. All remote traffic egresses from our Vercel IPs, so
   without mitigation every anonymous user would share one 60/hr bucket — one
   abuser starves everyone. **Mitigated:** warp-agent-mcp 0.16.0's client
   accepts per-request extra headers, and the remote forwards the end client's
   IP as `x-forwarded-for`, so upstream buckets per end user. Not a security
   downgrade: XFF is client-suppliable against the public endpoint anyway.
2. **Compute abuse on the remote itself.** Anonymous `tools/call` is limited to
   **60/hr per end-client IP** in Upstash (cross-instance, unlike upstream's
   per-instance window), returning 429 + `Retry-After`. `initialize` and
   `tools/list` stay uncounted — they are the discovery handshake and cost ~0.
   Without KV env the limiter fails open (dev), same policy as every kv helper.
3. **Booking/charge risk.** None added: anonymous sessions are refused at
   dispatch before any upstream call, and upstream booking fails closed without
   a key regardless. The gate is defense-in-depth, not the only wall.
4. **Credential capture.** Reduced: `login` is now refused outright on the
   hosted connector instead of accepting a password into a shared lambda.
5. **Scrapers enumerating the toolset.** They already can — the roster is
   published in `/.well-known/mcp.json`, npm, and the registry. Discovery here
   adds nothing they don't have.

Residual risk: IPv6 rotation / large NATs make per-IP limits imperfect in both
directions. Acceptable for a quote-only surface whose worst case is a free
quote; the kill switch covers surprises.

## Rollback

`ANON_DISCOVERY=0` env var → the old 401-everything behavior. Verified locally
(no code rollback, just env + redeploy).

## The one unknown to test on a real connector

When `initialize` succeeds anonymously, does Claude's connector UI still offer
the OAuth sign-in path (so a user can upgrade to booking), or does it treat the
server as no-auth and never show "Sign in"? Our discovery documents still
advertise OAuth and gated tools point at Settings → Connectors → Warp → Sign
in, but the first-run UX needs one manual check in Claude web/desktop after
deploy. If sign-in does not surface, fallback guidance (remove + re-add the
connector) is already in the gate message. The ChatGPT endpoint
(`/api/chatgpt/mcp`) is deliberately unchanged pending this same check.

## Verification (all green locally, 2026-07-25)

`node scripts/smoke-keyless.mjs` — anonymous initialize not-401, roster listed,
real anonymous LTL price, `book` gated with sign-in pointer before upstream,
`login` OAuth-only, `payment_status` gated; plus keyed-session passthrough and
the `ANON_DISCOVERY=0` 401 check. The same script points at production for
post-deploy verification:
`node scripts/smoke-keyless.mjs https://mcp.wearewarp.com/api/mcp`
