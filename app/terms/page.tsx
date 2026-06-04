import { Shell } from "@/components/brand";

export const metadata = {
  title: "Warp MCP — Terms of Service",
  description: "Terms governing use of the Warp MCP connector.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16.5, fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 8px" }}>{title}</h2>
      <div className="muted" style={{ lineHeight: 1.75, fontSize: 14.5 }}>{children}</div>
    </section>
  );
}

const strong = { color: "var(--text)", fontWeight: 600 } as const;

export default function Terms() {
  return (
    <Shell>
      <h1 className="h1" style={{ fontSize: 42, margin: "0 0 8px" }}>Terms of Service</h1>
      <p style={{ color: "var(--faint)", fontSize: 13, margin: "0 0 34px" }}>
        Warp MCP connector (<code className="inline">mcp.wearewarp.com</code>) · Last updated June 2026
      </p>

      <div className="card" style={{ padding: "10px 28px 28px" }}>
        <Section title="Acceptance">
          By connecting to or using the Warp MCP connector (the &ldquo;Service&rdquo;), you agree to these Terms. The
          Service is operated by Warp (wearewarp.com). Your underlying freight quotes, bookings, and shipments remain
          governed by your existing Warp customer agreement; these Terms cover use of the connector itself. If you do not
          agree, do not connect the Service.
        </Section>

        <Section title="What the Service is">
          The Service is a thin, stateless gateway that lets an AI assistant you choose (e.g. Claude or ChatGPT) act on
          your behalf against your own Warp freight account through the Model Context Protocol. It does not run your AI
          assistant and does not maintain its own copy of your freight data.
        </Section>

        <Section title="Eligibility &amp; account">
          You need an active Warp account to use the Service. You are responsible for maintaining the confidentiality of
          your credentials and for all activity performed through your authorized connection — including actions taken by
          an AI assistant you connect.
        </Section>

        <Section title="Authorized use">
          Use the Service only with a Warp account you are entitled to access, and only as the tools intend. You agree not
          to probe, scan, or attack the Service; circumvent authentication, rate limits, or access controls; or use it to
          access another party&apos;s account without authorization.
        </Section>

        <Section title="Bookings and charges">
          <span style={strong}>Booking a shipment is a real, billable action.</span> The booking tools create an actual
          freight shipment and charge the payment method already on file in your Warp account for that shipment. Payments
          are processed by Warp&apos;s existing billing systems, not by the connector. You are responsible for bookings
          made through your connection, including those initiated by an AI assistant you authorize. Because AI assistants
          can act autonomously, review quotes and confirm details before authorizing a booking.
        </Section>

        <Section title="AI output disclaimer">
          The Service executes tool calls issued by the AI client you connect. AI-generated requests and summaries may be
          incomplete or incorrect; you are responsible for verifying quotes, addresses, accessorials, and shipment details
          before relying on them or booking.
        </Section>

        <Section title="Availability">
          The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. We do not warrant that
          it will be uninterrupted or error-free, and we may modify, suspend, or discontinue any part of it at any time.
        </Section>

        <Section title="Limitation of liability">
          To the maximum extent permitted by law, Warp is not liable for indirect, incidental, special, or consequential
          damages arising from use of the connector. Nothing here limits Warp&apos;s obligations under your separate Warp
          customer agreement, which governs the freight services themselves.
        </Section>

        <Section title="Suspension &amp; termination">
          We may suspend or revoke access to the Service for misuse, security risk, or violation of these Terms. You can
          disconnect the connector in your AI client at any time, call the connector&apos;s revocation endpoint, or rotate
          your key in your Warp account.
        </Section>

        <Section title="Changes">
          We may update these Terms; material changes will be reflected by the &ldquo;last updated&rdquo; date above.
          Continued use after a change constitutes acceptance.
        </Section>

        <Section title="Contact">
          Questions about these Terms:{" "}
          <a className="link" href="mailto:support@wearewarp.com">support@wearewarp.com</a> ·{" "}
          <a className="link" href="https://www.wearewarp.com">wearewarp.com</a>.
        </Section>
      </div>
    </Shell>
  );
}
