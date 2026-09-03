"use client";

import { useAppState } from "@/lib/store/AppState";
import { formatMinor } from "@/lib/format";

export default function CartSidebar() {
  const { cart, removeFromCart, updateQuantity, beginCheckout, stage, checkout } = useAppState();
  // A checkout still being decided blocks starting another one — the review card in
  // the conversation is where that decision happens. A *finished* one does not: once
  // an order is paid, cancelled or expired it is history, and the customer shopping
  // again must be able to check out without first dismissing it.
  const settled =
    checkout !== null &&
    (checkout.order.paid ||
      checkout.order.status === "cancelled" ||
      checkout.order.status === "expired");
  const busy = stage !== null || (checkout !== null && !settled);

  return (
    <aside className="w-[300px] flex-none bg-white border-l border-border flex flex-col">
      <div className="px-4 pt-3.5 pb-3 border-b border-border-soft flex justify-between items-baseline">
        <span className="text-[13.5px] font-semibold">Your cart</span>
        <span className="font-mono text-[11px] text-ink-faint whitespace-nowrap">
          {cart.lines.length} {cart.lines.length === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {cart.lines.length === 0 && (
          <span className="text-[12.5px] text-ink-faint leading-relaxed">
            Empty. The agent adds items here as you accept them — you&apos;ll see each
            change land live.
          </span>
        )}
        {cart.lines.map((line) => (
          <div key={line.variant_id} className="rise-in flex gap-2.5 items-start">
            <div className="flex-none w-10 h-10 rounded-md bg-surface-muted border border-border-soft" />
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <span className="text-[12.5px] font-medium leading-tight truncate">{line.title}</span>
              <span className="text-[11px] text-ink-faint">
                {formatMinor(line.unit_price_minor)} each
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => updateQuantity(line.variant_id, line.quantity - 1)}
                  disabled={line.quantity <= 1}
                  aria-label={`Reduce quantity of ${line.title}`}
                  className="w-5 h-5 rounded border border-border text-[12px] leading-none text-ink-muted disabled:opacity-30"
                >
                  −
                </button>
                <span className="font-mono text-[11.5px] w-4 text-center">{line.quantity}</span>
                <button
                  onClick={() => updateQuantity(line.variant_id, line.quantity + 1)}
                  aria-label={`Increase quantity of ${line.title}`}
                  className="w-5 h-5 rounded border border-border text-[12px] leading-none text-ink-muted"
                >
                  +
                </button>
                <span className="font-mono text-[11.5px] text-ink ml-auto">
                  {formatMinor(line.amount_minor)}
                </span>
              </div>
            </div>
            <button
              onClick={() => removeFromCart(line.variant_id)}
              aria-label={`Remove ${line.title}`}
              className="text-ink-faint hover:text-danger text-[13px] px-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex-none px-4 py-3.5 border-t border-border-soft flex flex-col gap-2.5">
        <div className="flex justify-between items-baseline">
          <span className="text-[12.5px] text-ink-muted">Subtotal</span>
          <span className="font-mono text-[15px] font-medium">
            {formatMinor(cart.subtotal_minor)}
          </span>
        </div>
        <button
          onClick={beginCheckout}
          disabled={cart.lines.length === 0 || busy}
          className="w-full bg-ink text-bg rounded-lg py-2.5 text-[13.5px] font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          {stage ? "Review below" : "Checkout"}
        </button>
        <span className="text-[11px] text-ink-faint text-center leading-relaxed">
          Adding to your cart holds nothing. Stock is reserved when you confirm, and
          payment happens on Razorpay&apos;s own page — never through this app.
        </span>
      </div>
    </aside>
  );
}
