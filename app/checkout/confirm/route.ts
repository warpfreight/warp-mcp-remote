// POST /checkout/confirm — completes a ChatGPT booking on Warp's behalf.
//
// Opens the sealed checkout session (carries the user's Warp key + quote_id),
// then books through warp-site's EXISTING APIs:
//   • GET  /api/v1/agents/me   → is a card on file?
//   • POST /api/v1/book        → charges the card on file (authoritative price
//                                from the server-side quote_cache) + books.
// No card on file → we can't add one here (warp-site deliberately gates card
// changes behind the account's own password), so we hand the user to Warp's
// account page. The session is consumed (single-use) only at the actual book.
import { NextResponse } from "next/server";
import { peekCheckout, consumeCheckout } from "@/lib/checkout";

export const runtime = "nodejs";

const WARP_SITE_API = process.env.WARP_SITE_API ?? "https://www.wearewarp.com/api/v1";
const ACCOUNT_URL = "https://www.wearewarp.com/agents/account";

type Address = {
  zipCode?: string; city?: string; state?: string; street?: string;
  contactName?: string; phone?: string; email?: string; specialInstruction?: string;
};

export async function POST(req: Request) {
  let body: {
    session?: string;
    pickup?: Address;
    delivery?: Address;
    notes?: string;
    reference?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const token = body.session;
  if (!token) return NextResponse.json({ error: "Missing checkout session." }, { status: 400 });

  // Validate (don't consume yet) so the no-card path can be retried later.
  const peek = peekCheckout(token);
  if (!peek) {
    return NextResponse.json(
      { error: "This checkout link has expired. Re-run the booking in ChatGPT to get a fresh one.", code: "SESSION_EXPIRED" },
      { status: 410 },
    );
  }

  const authHeaders = { Authorization: `Bearer ${peek.key}`, "Content-Type": "application/json" };

  // 1. Is a card on file?
  try {
    const meRes = await fetch(`${WARP_SITE_API}/agents/me`, { headers: authHeaders, signal: AbortSignal.timeout(12000) });
    if (meRes.ok) {
      const me = (await meRes.json()) as { has_card?: boolean };
      if (!me.has_card) {
        return NextResponse.json(
          {
            needs_card: true,
            onboard_url: ACCOUNT_URL,
            error: "No payment method on file. Add a card to your Warp account, then re-run the booking in ChatGPT.",
            code: "NO_CARD",
          },
          { status: 402 },
        );
      }
    }
    // If /agents/me is unreachable or non-OK, fall through — /api/v1/book will
    // surface its own 402 if there's truly no card.
  } catch {
    /* fall through to book; book returns 402 on no card */
  }

  // 2. Consume the session (single-use) and book.
  const session = await consumeCheckout(token);
  if (!session) {
    return NextResponse.json(
      { error: "This booking was already completed (or the link expired).", code: "ALREADY_USED" },
      { status: 409 },
    );
  }

  const bookBody: Record<string, unknown> = {
    quote_id: session.quote_id,
    patch: {
      ...(body.pickup ? { pickup: body.pickup } : {}),
      ...(body.delivery ? { delivery: body.delivery } : {}),
      ...(body.notes ? { notes: body.notes } : {}),
    },
    ...(body.reference ? { reference: body.reference } : {}),
  };

  try {
    const bookRes = await fetch(`${WARP_SITE_API}/book`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(bookBody),
      signal: AbortSignal.timeout(45000),
    });
    const data = (await bookRes.json().catch(() => ({}))) as Record<string, unknown>;

    if (!bookRes.ok) {
      // No card slipped through the pre-check → surface the card path.
      if (bookRes.status === 402) {
        return NextResponse.json(
          { needs_card: true, onboard_url: ACCOUNT_URL, error: (data.error as string) ?? "A payment method is required.", code: "NO_CARD" },
          { status: 402 },
        );
      }
      return NextResponse.json(
        { error: (data.error as string) ?? "Booking failed. Please try again.", code: (data.code as string) ?? "BOOK_FAILED" },
        { status: bookRes.status },
      );
    }

    return NextResponse.json({
      booked: true,
      shipment_id: data.shipment_id ?? null,
      shipment_number: data.shipment_number ?? null,
      tracking_number: data.tracking_number ?? null,
      order_number: data.order_number ?? null,
      service: data.service ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach Warp to complete the booking. Please try again in a moment.", code: "UPSTREAM_ERROR" },
      { status: 502 },
    );
  }
}
