// Shared checkout render used by both /checkout?session=<token> and the short
// /b/<code> route. Opens the sealed session SERVER-SIDE (key never reaches the
// browser) and renders the confirm view (or an expired notice).
import { peekCheckout } from "@/lib/checkout";
import CheckoutForm from "./CheckoutForm";

const wrap: React.CSSProperties = {
  minHeight: "100vh", margin: 0, background: "#0d0d0d", color: "#e6e6e6",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px",
};

export function CheckoutShell({ token, redirectUrl }: { token: string; redirectUrl: string }) {
  const session = token ? peekCheckout(token) : null;

  if (!session) {
    return (
      <main style={wrap}>
        <div style={{ maxWidth: 420, textAlign: "center", paddingTop: 40 }}>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>This checkout link has expired</div>
          <p style={{ fontSize: 14, color: "#a0a0a0", lineHeight: 1.6 }}>
            Checkout links are valid for 30 minutes. Head back to ChatGPT and run the booking again to get a fresh one.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={wrap}>
      <CheckoutForm
        token={token}
        redirectUrl={redirectUrl}
        initialPickup={session.pickup}
        initialDelivery={session.delivery}
        quote={{
          quote_id: session.quote_id,
          amount_usd: session.amount_usd,
          mode: session.mode,
          origin_zip: session.origin_zip,
          destination_zip: session.destination_zip,
          pickup_date: session.pickup_date,
        }}
      />
    </main>
  );
}
