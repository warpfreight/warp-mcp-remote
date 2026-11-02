# Incident response: Warp MCP connector

Covers mcp.wearewarp.com (this repo, Vercel project `warp-mcp-remote`) and the `warp-agent-mcp` npm package.

## Contacts

| Role | Person | Reach |
|---|---|---|
| Incident lead (security contact) | Rahul Harikumar | r.ankarath@wearewarp.com |
| Backup / warp-site owner | Troy | troy@wearewarp.com |

The first person to notice an incident pages the lead. If the lead does not answer within 30 minutes, the backup takes over.

## What counts as an incident

- A leaked secret (`TOKEN_SECRET`, Upstash/KV tokens, Stripe keys, a customer's Warp API key).
- Unauthorized access to a user's account, quotes, bookings or payment method.
- A booking or charge the user did not approve.
- The connector serving another user's data.
- A vulnerability report from outside.

## Response steps

1. **Contain (first 30 minutes)**
   - Stop anonymous traffic: set `ANON_DISCOVERY=0` on the Vercel project and redeploy.
   - Stop all traffic if needed: in Vercel, roll back to the last known good deployment, or pause the project.
   - Leaked `TOKEN_SECRET`: rotate it in Vercel and redeploy. Every issued OAuth token becomes invalid and all users must sign in again.
   - Leaked KV/Upstash credentials: rotate them in the Upstash console, update Vercel env, redeploy.
   - Leaked customer Warp API key: revoke it from the customer's Warp account (warp-site agents account page) and issue a new one.
   - Single compromised session: revoke its token through `/revoke` or by writing `revoked:<jti>` in KV.
2. **Assess**: pull Vercel runtime logs and the connector Slack alerts for the time window. Record which users, tools and bookings were touched.
3. **Fix**: ship the fix through a reviewed pull request. Confirm it is live in production before calling it fixed.
4. **Notify**: tell affected users within 72 hours of confirming impact, in plain words: what happened, what data, what we did, what they should do. Notify Anthropic and other platform partners whose users were affected.
5. **Review**: within one week, write what happened, the root cause and the follow-ups in this folder.

## Testing this plan

Run a tabletop drill at least once a year and after any major change to the connector. Walk through one scenario end to end and record it below.

| Date | Scenario | Participants | Gaps found |
|---|---|---|---|
| | | | |
