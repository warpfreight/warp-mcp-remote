// Inline "Confirm & Pay on Warp" card for the ChatGPT app's compliant book tool.
//
// Booking can't charge inside ChatGPT, so warp_book returns this card. It reads
// the tool output (`window.openai.toolOutput`) and its button calls
// `window.openai.openExternal(checkout_url)` — OpenAI's external-checkout path.
// ChatGPT appends `?redirectUrl=` so our /checkout page can return the user to
// the conversation after booking.
//
// Served as a `text/html` MCP resource. Degrades gracefully: if `window.openai`
// is absent (non-Apps client) the tool's text content still carries the URL.

export const CHECKOUT_CARD_RESOURCE_URI = "ui://warp/checkout-card";

export function checkoutCardTemplate(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .card {
    border: 1px solid rgba(127,127,127,.22); border-radius: 14px; padding: 18px 18px 16px;
    max-width: 460px; background: rgba(127,127,127,.04);
  }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .lane { font-size: 15px; font-weight: 650; letter-spacing: -.01em; }
  .sub { font-size: 12.5px; opacity: .62; margin-top: 3px; }
  .price { font-size: 22px; font-weight: 750; letter-spacing: -.02em; white-space: nowrap; }
  .price small { font-size: 12px; font-weight: 600; opacity: .6; margin-left: 2px; }
  .cta {
    display: block; width: 100%; margin-top: 16px; padding: 12px 16px; border: 0; cursor: pointer;
    border-radius: 9px; background: #00FA8A; color: #06140d; font-size: 14px; font-weight: 750;
  }
  .cta:active { transform: translateY(1px); }
  .note { font-size: 11.5px; opacity: .55; text-align: center; margin-top: 10px; line-height: 1.45; }
  .err { font-size: 13px; opacity: .7; padding: 4px 2px; }
</style>
</head>
<body>
  <div id="root"><div class="err">Preparing your booking…</div></div>
  <script>
    (function () {
      function data() {
        try { return (window.openai && window.openai.toolOutput) || {}; } catch (e) { return {}; }
      }
      function money(n) {
        if (typeof n !== "number" || !isFinite(n)) return null;
        return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      }
      function go(url) {
        if (!url) return;
        try {
          if (window.openai && typeof window.openai.openExternal === "function") {
            window.openai.openExternal(url);
            return;
          }
        } catch (e) {}
        window.open(url, "_blank", "noopener");
      }
      function render() {
        var d = data();
        var root = document.getElementById("root");
        if (!d || !d.checkout_url) {
          root.innerHTML = '<div class="err">Preparing your booking…</div>';
          return;
        }
        var lane = (d.origin_zip && d.destination_zip)
          ? (d.origin_zip + " \\u2192 " + d.destination_zip) : "Your shipment";
        var sub = [d.mode, d.pickup_date].filter(Boolean).join(" \\u00b7 ");
        var price = money(d.amount_usd);
        var html = '<div class="card">'
          + '<div class="row"><div>'
          + '<div class="lane">' + lane + '</div>'
          + (sub ? '<div class="sub">' + sub + '</div>' : '')
          + '</div>'
          + (price ? '<div class="price">' + price + '<small>all-in</small></div>' : '')
          + '</div>'
          + '<button class="cta" id="pay">Confirm &amp; Pay on Warp &rarr;</button>'
          + '<div class="note">Payment is completed securely on Warp \\u2014 ChatGPT doesn\\u2019t handle the card. You\\u2019ll return here when it\\u2019s done.</div>'
          + '</div>';
        root.innerHTML = html;
        var btn = document.getElementById("pay");
        if (btn) btn.addEventListener("click", function () { go(d.checkout_url); });
      }
      render();
      // ChatGPT dispatches this when tool output/globals settle after first paint.
      window.addEventListener("openai:set_globals", render);
    })();
  </script>
</body>
</html>`;
}
