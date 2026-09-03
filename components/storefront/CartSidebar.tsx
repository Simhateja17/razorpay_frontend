"use client";

import { useAppState } from "@/lib/store/AppState";
import { formatINR } from "@/lib/format";

export default function CartSidebar() {
  const { cart, removeFromCart, beginCheckout } = useAppState();

  return (
    <aside className="w-[300px] flex-none bg-white border-l border-border flex flex-col">
      <div className="px-4 pt-3.5 pb-3 border-b border-border-soft flex justify-between items-baseline">
        <span className="text-[13.5px] font-semibold">Your cart</span>
        <span className="font-mono text-[11px] text-ink-faint whitespace-nowrap">{cart.lines.length} items</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {cart.lines.length === 0 && (
          <span className="text-[12.5px] text-ink-faint leading-relaxed">
            Empty. The agent adds items here as you accept them — you&apos;ll see each change land live.
          </span>
        )}
        {cart.lines.map((line) => (
          <div key={line.product_id} className="rise-in flex gap-2.5 items-start">
            <div className="flex-none w-10 h-10 rounded-md bg-surface-muted border border-border-soft" />
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-[12.5px] font-medium leading-tight truncate">{line.name}</span>
              <span className="text-[11px] text-ink-faint">{line.quantity > 1 ? `×${line.quantity} · ` : ""}{formatINR(line.price)}</span>
            </div>
            <button
              onClick={() => removeFromCart(line.product_id)}
              aria-label={`Remove ${line.name}`}
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
          <span className="font-mono text-[15px] font-medium">{formatINR(cart.total)}</span>
        </div>
        <button
          onClick={beginCheckout}
          disabled={cart.lines.length === 0}
          className="w-full bg-ink text-bg rounded-lg py-2.5 text-[13.5px] font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          Checkout
        </button>
        <span className="text-[11px] text-ink-faint text-center leading-relaxed">
          Cart bound: ₹10,000 per checkout. Payment happens on Razorpay&apos;s real test-mode page — it never moves through this app directly.
        </span>
      </div>
    </aside>
  );
}
