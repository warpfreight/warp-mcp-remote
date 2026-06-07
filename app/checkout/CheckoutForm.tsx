"use client";

import { useState } from "react";

type Quote = {
  quote_id: string;
  amount_usd?: number;
  mode?: string;
  origin_zip?: string;
  destination_zip?: string;
  pickup_date?: string;
};

type Addr = {
  contactName: string; street: string; city: string; state: string;
  zipCode: string; phone: string; email: string; specialInstruction: string;
};

const fillAddr = (zip = "", init?: Partial<Addr>): Addr => ({
  contactName: init?.contactName ?? "",
  street: init?.street ?? "",
  city: init?.city ?? "",
  state: init?.state ?? "",
  zipCode: init?.zipCode ?? zip,
  phone: init?.phone ?? "",
  email: init?.email ?? "",
  specialInstruction: init?.specialInstruction ?? "",
});

// /api/v1/book requires all of these on each stop (unless a default shipper /
// prior lane covers it). Complete → we can show a confirm-only view.
const isComplete = (a: Addr) =>
  !!(a.contactName && a.street && a.city && a.state && a.zipCode && a.phone && a.email);

const C = {
  green: "#00FA8A", bg2: "#161616", bg3: "#1f1f1f", text: "#e6e6e6", text2: "#a0a0a0",
  border: "rgba(255,255,255,0.12)",
};

const card: React.CSSProperties = {
  width: "100%", maxWidth: 520, background: C.bg2, border: `1px solid ${C.border}`,
  borderRadius: 16, padding: 24,
};
const label: React.CSSProperties = { display: "block", fontSize: 12, color: C.text2, margin: "0 0 5px" };
const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "#0d0d0d", border: `1px solid ${C.border}`,
  borderRadius: 8, color: C.text, padding: "9px 11px", fontSize: 14, marginBottom: 11, outline: "none",
};

function money(n?: number): string | null {
  if (typeof n !== "number" || !isFinite(n)) return null;
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function CheckoutForm({
  token, redirectUrl, quote, initialPickup, initialDelivery,
}: {
  token: string; redirectUrl: string; quote: Quote;
  initialPickup?: Partial<Addr>; initialDelivery?: Partial<Addr>;
}) {
  const initPickup = fillAddr(quote.origin_zip ?? "", initialPickup);
  const initDelivery = fillAddr(quote.destination_zip ?? "", initialDelivery);

  const [pickup, setPickup] = useState<Addr>(initPickup);
  const [delivery, setDelivery] = useState<Addr>(initDelivery);
  const [notes, setNotes] = useState("");
  const [reference, setReference] = useState("");
  // Confirm-only by default when both stops are complete (the common case: the
  // assistant passed the contacts from chat). Drop into edit mode otherwise.
  const [editing, setEditing] = useState(!(isComplete(initPickup) && isComplete(initDelivery)));
  const [status, setStatus] = useState<"idle" | "submitting" | "booked" | "needs_card" | "error">("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [onboardUrl, setOnboardUrl] = useState("");

  const lane = quote.origin_zip && quote.destination_zip
    ? `${quote.origin_zip} → ${quote.destination_zip}` : "Your shipment";
  const price = money(quote.amount_usd);

  async function submit() {
    // If anything required is still missing, force the form open instead of
    // submitting an incomplete booking.
    if (!isComplete(pickup) || !isComplete(delivery)) {
      setEditing(true);
      setStatus("error");
      setMessage("A few contact details are needed before booking — please complete the highlighted fields.");
      return;
    }
    setStatus("submitting");
    setMessage("");
    try {
      const res = await fetch("/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: token, pickup, delivery, notes, reference }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.ok && data.booked) {
        setResult(data);
        setStatus("booked");
      } else if (res.status === 402 || data.needs_card) {
        setOnboardUrl((data.onboard_url as string) || "https://www.wearewarp.com/agents/account");
        setMessage((data.error as string) || "A payment method is required.");
        setStatus("needs_card");
      } else {
        setMessage((data.error as string) || "Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch {
      setMessage("Couldn't reach Warp. Check your connection and try again.");
      setStatus("error");
    }
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (status === "booked") {
    return (
      <div style={{ ...card, textAlign: "center" }}>
        <div style={{ fontSize: 34, marginBottom: 8 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 750, marginBottom: 6 }}>Booked!</div>
        <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, margin: "0 0 16px" }}>
          {lane}{price ? ` · ${price}` : ""} is confirmed.
          {result?.tracking_number ? ` Tracking: ${String(result.tracking_number)}.` : ""}
        </p>
        {redirectUrl ? (
          <a href={redirectUrl} style={{ display: "inline-block", background: C.green, color: "#06140d", fontWeight: 750, fontSize: 14, padding: "11px 22px", borderRadius: 9, textDecoration: "none" }}>
            Return to ChatGPT →
          </a>
        ) : (
          <p style={{ fontSize: 13, color: C.text2 }}>You can close this tab and head back to ChatGPT.</p>
        )}
      </div>
    );
  }

  // ── No card on file (same as Claude: send them to add one) ──────────────────
  if (status === "needs_card") {
    return (
      <div style={{ ...card, textAlign: "center" }}>
        <div style={{ fontSize: 17, fontWeight: 750, marginBottom: 8 }}>Add a payment method first</div>
        <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, margin: "0 0 18px" }}>{message}</p>
        <a href={onboardUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", background: C.green, color: "#06140d", fontWeight: 750, fontSize: 14, padding: "11px 22px", borderRadius: 9, textDecoration: "none" }}>
          Add a card on Warp →
        </a>
        <p style={{ fontSize: 12.5, color: C.text2, marginTop: 16, lineHeight: 1.5 }}>
          For your security, cards are managed on your own Warp account. Once it&apos;s added, re-run the booking in ChatGPT.
        </p>
      </div>
    );
  }

  // ── Confirm (or edit) ───────────────────────────────────────────────────────
  const submitting = status === "submitting";
  return (
    <div style={card}>
      {/* Summary */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, paddingBottom: 16, borderBottom: `1px solid ${C.border}`, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 750, letterSpacing: "-0.01em" }}>{lane}</div>
          <div style={{ fontSize: 12.5, color: C.text2, marginTop: 4 }}>
            {[quote.mode, quote.pickup_date].filter(Boolean).join(" · ") || "Confirm the details below"}
          </div>
        </div>
        {price && (
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
            {price}<span style={{ fontSize: 11, fontWeight: 600, color: C.text2, marginLeft: 3 }}>all-in</span>
          </div>
        )}
      </div>

      {editing ? (
        <>
          <AddressFields title="Pickup" value={pickup} onChange={setPickup} />
          <AddressFields title="Delivery" value={delivery} onChange={setDelivery} />
          <label style={label}>Reference # (optional)</label>
          <input style={input} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Your PO or internal reference" />
          <label style={label}>Notes (optional)</label>
          <input style={input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Special instructions for the carrier" />
        </>
      ) : (
        <>
          <AddressSummary title="Pickup" a={pickup} />
          <AddressSummary title="Delivery" a={delivery} />
          <button
            onClick={() => setEditing(true)}
            style={{ background: "transparent", border: "none", color: C.text2, fontSize: 12.5, cursor: "pointer", padding: "2px 0 14px", textDecoration: "underline" }}
          >
            Edit details
          </button>
        </>
      )}

      {status === "error" && (
        <div style={{ fontSize: 13, color: "#f8a8aa", background: "rgba(229,72,77,.1)", border: "1px solid rgba(229,72,77,.35)", borderRadius: 8, padding: "9px 11px", margin: "4px 0 12px" }}>
          {message}
        </div>
      )}

      <button
        onClick={submit}
        disabled={submitting}
        style={{
          width: "100%", marginTop: 8, padding: "13px 16px", border: 0, borderRadius: 10,
          background: submitting ? "#0c6e44" : C.green, color: "#06140d", fontSize: 15, fontWeight: 800,
          cursor: submitting ? "default" : "pointer",
        }}
      >
        {submitting ? "Booking…" : price ? `Confirm & Pay ${price}` : "Confirm & Book"}
      </button>
      <p style={{ fontSize: 11.5, color: C.text2, textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
        Charged to the card on your Warp account. You&apos;ll return to ChatGPT once it&apos;s booked.
      </p>
    </div>
  );
}

function AddressSummary({ title, a }: { title: string; a: Addr }) {
  const line2 = [a.street, a.city, [a.state, a.zipCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const line3 = [a.phone, a.email].filter(Boolean).join(" · ");
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{title}</div>
      {a.contactName && <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{a.contactName}</div>}
      {line2 && <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.5 }}>{line2}</div>}
      {line3 && <div style={{ fontSize: 12.5, color: C.text2, marginTop: 2 }}>{line3}</div>}
    </div>
  );
}

function AddressFields({
  title, value, onChange,
}: {
  title: string; value: Addr; onChange: (a: Addr) => void;
}) {
  const set = (k: keyof Addr) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  const half: React.CSSProperties = { display: "flex", gap: 10 };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.green, margin: "2px 0 9px" }}>{title}</div>
      <label style={label}>Contact name</label>
      <input style={input} value={value.contactName} onChange={set("contactName")} placeholder="Full name" />
      <label style={label}>Street address</label>
      <input style={input} value={value.street} onChange={set("street")} placeholder="123 Main St" />
      <div style={half}>
        <div style={{ flex: 2 }}>
          <label style={label}>City</label>
          <input style={input} value={value.city} onChange={set("city")} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={label}>State</label>
          <input style={input} value={value.state} onChange={set("state")} placeholder="CA" maxLength={2} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={label}>ZIP</label>
          <input style={input} value={value.zipCode} onChange={set("zipCode")} maxLength={5} />
        </div>
      </div>
      <div style={half}>
        <div style={{ flex: 1 }}>
          <label style={label}>Phone</label>
          <input style={input} value={value.phone} onChange={set("phone")} placeholder="(213) 555-0199" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={label}>Email</label>
          <input style={input} value={value.email} onChange={set("email")} placeholder="name@company.com" />
        </div>
      </div>
    </div>
  );
}
