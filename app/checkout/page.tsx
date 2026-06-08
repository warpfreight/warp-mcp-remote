// /checkout?session=<sealed token> — the full-token checkout link (fallback when
// KV is unavailable). Most links go through the short /b/<code> route instead.
import { CheckoutShell } from "./shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // session-bearing; never cache

export default function CheckoutPage({
  searchParams,
}: {
  searchParams: { session?: string; redirectUrl?: string };
}) {
  return <CheckoutShell token={searchParams.session ?? ""} redirectUrl={searchParams.redirectUrl ?? ""} />;
}
