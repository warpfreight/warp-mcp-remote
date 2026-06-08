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

const isComplete = (a: Addr) =>
  !!(a.contactName && a.street && a.city && a.state && a.zipCode && a.phone && a.email);

const C = {
  green: "#00FA8A", ink: "#06140d", bg2: "#161616", bg3: "#1f1f1f",
  text: "#e6e6e6", text2: "#9a9a9a", text3: "#6b6b6b", border: "rgba(255,255,255,0.10)",
};

const card: React.CSSProperties = {
  width: "100%", maxWidth: 460, background: C.bg2, border: `1px solid ${C.border}`,
  borderRadius: 18, padding: "26px 26px 22px",
};
const label: React.CSSProperties = { display: "block", fontSize: 11.5, color: C.text2, margin: "0 0 5px", letterSpacing: "0.01em" };
const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "#0d0d0d", border: `1px solid ${C.border}`,
  borderRadius: 8, color: C.text, padding: "9px 11px", fontSize: 14, marginBottom: 11, outline: "none",
};
const primaryBtn: React.CSSProperties = {
  display: "inline-block", width: "100%", boxSizing: "border-box", textAlign: "center",
  background: C.green, color: C.ink, fontSize: 15, fontWeight: 800, padding: "13px 16px",
  border: 0, borderRadius: 11, cursor: "pointer", textDecoration: "none",
};
const mono: React.CSSProperties = { fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: 13.5, color: C.text, letterSpacing: "0.01em" };

function money(n?: number): string | null {
  if (typeof n !== "number" || !isFinite(n)) return null;
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function WarpMark() {
  return (
    <svg width="78" height="22" viewBox="0 0 660 186" fill="none" aria-label="Warp" style={{ display: "block", marginBottom: 18 }}>
      <path d="M660 185.035H0V0H660V185.035ZM14.0597 171.327H646.141V13.9593H14.0597V171.327Z" fill={C.green} />
      <path d="M300.976 53.2756L332.509 131.608H351.239L319.705 53.2756H300.976Z" fill={C.green} />
      <path d="M215.919 131.608H234.648L266.182 53.2756H247.453L215.919 131.608Z" fill={C.green} />
      <path d="M150.892 107.405L136.431 71.3523H115.593L101.131 107.405L78.2342 53.2756H60.0068L93.047 131.608H109.517L125.987 90.5839L142.457 131.608H158.927L192.017 53.2756H173.739L150.892 107.405Z" fill={C.green} />
      <path d="M471.856 82.8511C471.816 75.0646 468.691 67.6113 463.166 62.1242C457.642 56.6371 450.167 53.5636 442.381 53.5769H388.502V131.608H405.323V112.125H440.021L447.854 131.608H465.981L456.691 108.41C461.258 105.886 465.065 102.183 467.715 97.6881C470.364 93.1928 471.759 88.0691 471.755 82.8511H471.856ZM405.323 70.3481H442.381C445.71 70.3481 448.903 71.6706 451.257 74.0248C453.611 76.379 454.934 79.572 454.934 82.9013C454.934 86.2307 453.611 89.4236 451.257 91.7778C448.903 94.132 445.71 95.4546 442.381 95.4546H405.323V70.3481Z" fill={C.green} />
      <path d="M570.768 53.5769H516.939V131.608H533.711V112.125H570.768C574.612 112.125 578.419 111.368 581.971 109.897C585.522 108.426 588.749 106.269 591.468 103.551C594.186 100.833 596.342 97.6055 597.814 94.0538C599.285 90.5021 600.042 86.6954 600.042 82.8511C600.042 79.0067 599.285 75.2 597.814 71.6483C596.342 68.0966 594.186 64.8695 591.468 62.1511C588.749 59.4327 585.522 57.2764 581.971 55.8053C578.419 54.3341 574.612 53.5769 570.768 53.5769ZM570.768 95.4043H533.711V70.2978H570.768C574.097 70.2978 577.29 71.6204 579.644 73.9746C581.998 76.3288 583.321 79.5217 583.321 82.8511C583.321 86.1804 581.998 89.3734 579.644 91.7276C577.29 94.0818 574.097 95.4043 570.768 95.4043Z" fill={C.green} />
      <path d="M292.04 76.1794H275.219V94.1557H292.04V76.1794Z" fill={C.green} />
      <path d="M275.219 131.615H292.04V113.84H275.219V131.615Z" fill={C.green} />
    </svg>
  );
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
  const [editing, setEditing] = useState(!(isComplete(initPickup) && isComplete(initDelivery)));
  const [status, setStatus] = useState<"idle" | "submitting" | "booked" | "needs_card" | "error">("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [onboardUrl, setOnboardUrl] = useState("");

  const lane = quote.origin_zip && quote.destination_zip
    ? `${quote.origin_zip} → ${quote.destination_zip}` : "Your shipment";
  const price = money(quote.amount_usd);

  async function submit() {
    if (!isComplete(pickup) || !isComplete(delivery)) {
      setEditing(true);
      setStatus("error");
      setMessage("A few contact details are needed before booking — please complete the fields below.");
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

  // ── Booked ──────────────────────────────────────────────────────────────────
  if (status === "booked") {
    const r = result ?? {};
    const rows: Array<[string, string]> = [];
    if (r.shipment_number) rows.push(["Shipment", String(r.shipment_number)]);
    if (r.order_number) rows.push(["Order", String(r.order_number)]);
    if (r.tracking_number) rows.push(["Tracking", String(r.tracking_number)]);
    return (
      <div style={card}>
        <WarpMark />
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: C.green, display: "flex", alignItems: "center", justifyContent: "center", margin: "6px 0 14px" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12.5L10 17.5L19 7" stroke={C.ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.01em", marginBottom: 5 }}>Booking confirmed</div>
        <p style={{ fontSize: 13.5, color: C.text2, lineHeight: 1.55, margin: "0 0 18px" }}>
          {lane}{price ? ` · ${price} all-in` : ""}. {quote.pickup_date ? `Pickup ${quote.pickup_date}.` : ""} Your card on file was charged.
        </p>

        {rows.length > 0 && (
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 18 }}>
            {rows.map(([k, v], i) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "11px 14px", borderTop: i ? `1px solid ${C.border}` : "none" }}>
                <span style={{ fontSize: 12.5, color: C.text2 }}>{k}</span>
                <span style={mono}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {redirectUrl ? (
          <a href={redirectUrl} style={primaryBtn}>Return to ChatGPT</a>
        ) : (
          <p style={{ fontSize: 13, color: C.text2, margin: 0 }}>You can close this tab and head back to ChatGPT.</p>
        )}
        <a href="https://customer.wearewarp.com" target="_blank" rel="noopener noreferrer"
          style={{ display: "block", textAlign: "center", marginTop: 12, fontSize: 12.5, color: C.text2, textDecoration: "none" }}>
          Track &amp; manage on Warp
        </a>
      </div>
    );
  }

  // ── No card on file ─────────────────────────────────────────────────────────
  if (status === "needs_card") {
    return (
      <div style={card}>
        <WarpMark />
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>Add a payment method first</div>
        <p style={{ fontSize: 13.5, color: C.text2, lineHeight: 1.55, margin: "0 0 18px" }}>{message}</p>
        <a href={onboardUrl} target="_blank" rel="noopener noreferrer" style={primaryBtn}>Add a card on Warp</a>
        <p style={{ fontSize: 12, color: C.text3, marginTop: 14, lineHeight: 1.5 }}>
          For your security, cards are managed on your own Warp account. Once it&apos;s added, re-run the booking in ChatGPT.
        </p>
      </div>
    );
  }

  // ── Confirm (or edit) ───────────────────────────────────────────────────────
  const submitting = status === "submitting";
  return (
    <div style={card}>
      <WarpMark />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, paddingBottom: 16, borderBottom: `1px solid ${C.border}`, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em" }}>{lane}</div>
          <div style={{ fontSize: 12.5, color: C.text2, marginTop: 4 }}>
            {[quote.mode, quote.pickup_date].filter(Boolean).join(" · ") || "Confirm the details below"}
          </div>
        </div>
        {price && (
          <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
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
          <button onClick={() => setEditing(true)}
            style={{ background: "transparent", border: "none", color: C.text2, fontSize: 12.5, cursor: "pointer", padding: "2px 0 14px", textDecoration: "underline" }}>
            Edit details
          </button>
        </>
      )}

      {status === "error" && (
        <div style={{ fontSize: 13, color: "#f8a8aa", background: "rgba(229,72,77,.1)", border: "1px solid rgba(229,72,77,.35)", borderRadius: 8, padding: "9px 11px", margin: "4px 0 12px" }}>
          {message}
        </div>
      )}

      <button onClick={submit} disabled={submitting} style={{ ...primaryBtn, marginTop: 8, background: submitting ? "#0c6e44" : C.green, cursor: submitting ? "default" : "pointer" }}>
        {submitting ? "Booking…" : price ? `Confirm & Pay ${price}` : "Confirm & Book"}
      </button>
      <p style={{ fontSize: 11.5, color: C.text3, textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
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
      <div style={{ fontSize: 11, fontWeight: 700, color: C.green, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</div>
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
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.green, margin: "2px 0 9px" }}>{title}</div>
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
