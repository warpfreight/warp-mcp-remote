// /checkout — where ChatGPT users land to confirm + pay for a booking on Warp.
//
// The sealed session (which carries the user's Warp key) is opened SERVER-SIDE
// here; only display fields are passed to the client form. The key never reaches
// the browser — the form re-submits the sealed token to /checkout/confirm, which
// unseals it server-side to book.
import { peekCheckout } from "@/lib/checkout";
import CheckoutForm from "./CheckoutForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // session-bearing; never cache

const wrap: React.CSSProperties = {
  minHeight: "100vh", margin: 0, background: "#0d0d0d", color: "#e6e6e6",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px",
};

export default function CheckoutPage({
  searchParams,
}: {
  searchParams: { session?: string; redirectUrl?: string };
}) {
  const token = searchParams.session ?? "";
  const session = token ? peekCheckout(token) : null;
  const redirectUrl = searchParams.redirectUrl ?? "";

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
