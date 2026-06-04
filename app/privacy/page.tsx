import { Shell, card, muted, accent } from "@/components/brand";

export const metadata = {
  title: "Warp MCP — Privacy Policy",
  description: "What the Warp MCP connector accesses, stores, and shares.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <h2 style={{ fontSize: 16, fontWeight: 650, margin: "0 0 8px", color: "#e2e8f0" }}>{title}</h2>
      <div style={{ color: muted, lineHeight: 1.7, fontSize: 14.5 }}>{children}</div>
    </section>
  );
}

export default function Privacy() {
  return (
    <Shell>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Privacy Policy</h1>
      <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 28px" }}>
        Warp MCP connector (<code style={{ color: accent }}>mcp.wearewarp.com</code>) · Last updated June 2026
      </p>

      <div style={{ ...card, padding: "8px 24px 24px" }}>
        <Section title="Overview">
          This connector lets an AI assistant you choose (e.g. Claude or ChatGPT) act on your behalf against your Warp
          freight account through the Model Context Protocol. It is operated by Warp (wearewarp.com). It is a thin,
          stateless gateway — it does not run your AI assistant and does not maintain its own copy of your freight data.
        </Section>

        <Section title="Information we access">
          Only what the tools you invoke require, using the authorization you grant at sign-in: freight quotes, bookings,
          shipments and tracking events, shipment documents (BOL/POD), invoices, saved pickup/delivery locations and load
          templates, and your payment status — limited to whether a card is on file plus its brand and last four digits.
          We never receive full card numbers.
        </Section>

        <Section title="Credentials">
          When you sign in, your email and password are transmitted directly to Warp&apos;s authentication service to mint
          a scoped access key. <strong style={{ color: "#e2e8f0" }}>We never store your password, and the AI assistant
          never receives it.</strong>
        </Section>

        <Section title="What we store">
          Nothing persistent about your freight activity. The only stored items are: (1) an opaque, AES-256-GCM-encrypted
          access token held by your AI client — it contains your scoped Warp key sealed so only this service can read it,
          and we keep no copy; and (2) short-lived entries in a key-value store used solely to enforce one-time
          authorization codes and token revocation (seconds-to-days TTL, containing random identifiers, no personal data).
          We do not keep databases of your shipments and we do not log your credentials or freight data.
        </Section>

        <Section title="How your information is used">
          Tool results are returned only to the AI client you connected, to fulfill the requests you make. We do{" "}
          <strong style={{ color: "#e2e8f0" }}>not</strong> sell, rent, or share your information with third parties, and
          we do not use it for advertising or to train models.
        </Section>

        <Section title="Payments">
          Booking a shipment charges the payment method already on file in your Warp account. Payments are processed by
          Warp&apos;s existing billing systems, not by this connector.
        </Section>

        <Section title="Revoking access">
          You can disconnect the connector in your AI client at any time, call the connector&apos;s revocation endpoint, or
          rotate your key in your Warp account — any of which invalidates access. Access tokens also expire automatically.
        </Section>

        <Section title="Security">
          All traffic is served over HTTPS. Access tokens are AES-256-GCM encrypted; sign-in uses OAuth 2.1 with PKCE and
          a one-time, single-use authorization code. Credentials and freight data are never written to logs.
        </Section>

        <Section title="Contact">
          Questions about this policy or your data: <a href="mailto:support@wearewarp.com" style={{ color: accent }}>support@wearewarp.com</a> ·{" "}
          <a href="https://www.wearewarp.com" style={{ color: accent }}>wearewarp.com</a>.
        </Section>

        <Section title="Changes">
          We may update this policy; material changes will be reflected by the &ldquo;last updated&rdquo; date above.
        </Section>
      </div>
    </Shell>
  );
}
