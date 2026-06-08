// /b/<code> — short, clean booking link. Resolves the short code to the sealed
// checkout session in KV, then renders the same confirm view as /checkout. The
// short URL is what warp_book hands the model, because models relay a tidy link
// verbatim but tend to replace a long opaque ?session= token with a guessed URL.
import { getShortCheckout } from "@/lib/kv";
import { CheckoutShell } from "@/app/checkout/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ShortCheckoutPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { redirectUrl?: string };
}) {
  const token = (await getShortCheckout(params.code)) ?? "";
  return <CheckoutShell token={token} redirectUrl={searchParams?.redirectUrl ?? ""} />;
}
