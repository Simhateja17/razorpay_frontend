"use client";

import { useState } from "react";
import { useAppState } from "@/lib/store/AppState";
import { formatMinor } from "@/lib/format";

/**
 * The confirmed order and its Razorpay handoff.
 *
 * The rule this panel exists to hold: **only `order.paid` renders as paid.** Coming
 * back from Razorpay is not payment — it moves the order to
 * `payment_verification_pending`, and the panel says exactly that until a verified
 * provider event proves the exact order, amount and reference were fully paid
 * (ADR 0013). A retry is a new attempt on the same order, never a second order.
 */
export default function PaymentPanel() {
  const { checkout, refreshOrder, retryPayment, paymentReturned, checkoutError, dismissCheckout } =
    useAppState();
  const [busy, setBusy] = useState<"check" | "retry" | null>(null);

  if (!checkout) return null;
  const { order, payment } = checkout;

  const run = async (kind: "check" | "retry", fn: () => Promise<unknown>) => {
    setBusy(kind);
    await fn();
    setBusy(null);
  };

  if (order.paid) {
    return (
      <section className="ml-9 max-w-[430px] bg-success-bg border border-success-border rounded-xl p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <span className="w-[22px] h-[22px] rounded-md bg-accent text-white flex items-center justify-center text-[12px]">
            ✓
          </span>
          <span className="text-[14.5px] font-medium">
            Paid {formatMinor(order.amount_paid_minor)}
          </span>
        </div>
        <span className="text-[13px] text-success-ink leading-relaxed">
          Order <span className="font-mono">{order.order_id}</span> is confirmed. Razorpay
          verified the payment for this exact order and amount.
        </span>
        <button
          onClick={dismissCheckout}
          className="self-start text-[12px] text-ink-muted underline underline-offset-2"
        >
          Done
        </button>
      </section>
    );
  }

  const terminal = order.status === "cancelled" || order.status === "expired";
  const declined = order.attempts.some((a) => a.status === "failed") && !terminal;
  const awaiting = order.status === "payment_verification_pending";

  if (terminal) {
    return (
      <section className="ml-9 max-w-[470px] bg-danger-bg border border-danger-border rounded-xl p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <span className="w-[22px] h-[22px] rounded-md bg-danger text-white flex items-center justify-center text-[13px] font-semibold">
            !
          </span>
          <span className="text-[14.5px] font-medium">
            This order was {order.status === "expired" ? "expired" : "cancelled"}
          </span>
        </div>
        <p className="m-0 text-[13.5px] leading-relaxed text-[#5d5d58]">
          Nothing was charged, and the items it was holding are back in stock. Add them
          again to start a fresh checkout.
        </p>
        <span className="font-mono text-[10.5px] text-ink-faint">order {order.order_id}</span>
      </section>
    );
  }

  return (
    <section className="ml-9 max-w-[430px] bg-white border border-[#cfd9d5] rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 pt-4 pb-3 flex flex-col gap-2.5">
        <div className="flex justify-between items-baseline">
          <span className="font-mono text-[10px] text-ink-faint tracking-wide">
            {declined ? "PAYMENT RETRY" : "CHECKOUT HANDOFF"}
          </span>
          <span className="font-mono text-[10px] text-ink-faint">RAZORPAY · TEST</span>
        </div>

        {declined && (
          <p className="m-0 text-[13px] leading-relaxed text-[#5d5d58]">
            That payment didn&apos;t go through, and nothing was charged. Your order and
            the items it&apos;s holding are still here — try again with the link below.
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          {order.lines.map((line) => (
            <div
              key={line.variant_id}
              className="flex justify-between gap-3 text-[13px] text-[#3d3d39]"
            >
              <span>
                {line.title}
                {line.quantity > 1 ? ` ×${line.quantity}` : ""}
              </span>
              <span className="font-mono text-ink">{formatMinor(line.amount_minor)}</span>
            </div>
          ))}
        </div>
        <div className="h-px bg-border-soft" />
        <div className="flex justify-between items-baseline">
          <span className="text-[13.5px] font-medium">Total payable</span>
          <span className="font-mono text-[19px] font-medium">
            {formatMinor(order.total_minor)}
          </span>
        </div>
      </div>

      <div className="px-4 pb-4 flex flex-col gap-2">
        {payment.pay_url ? (
          <a
            href={payment.pay_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => paymentReturned(order.order_id)}
            className="w-full text-center bg-accent text-white border-none rounded-lg py-3 text-[14px] font-medium hover:bg-accent-hover transition-colors"
          >
            Pay {formatMinor(order.total_minor)} via Razorpay
          </a>
        ) : (
          <button
            onClick={() => run("retry", () => retryPayment(order.order_id))}
            disabled={busy !== null}
            className="w-full bg-accent text-white border-none rounded-lg py-3 text-[14px] font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {busy === "retry" ? "Requesting link…" : "Get the payment link"}
          </button>
        )}

        {declined && payment.pay_url && (
          <button
            onClick={() => run("retry", () => retryPayment(order.order_id))}
            disabled={busy !== null}
            className="w-full bg-white text-ink border border-border rounded-lg py-2 text-[12.5px] hover:bg-bg transition-colors disabled:opacity-50"
          >
            {busy === "retry" ? "Starting a new attempt…" : "Start a new payment attempt"}
          </button>
        )}

        <button
          onClick={() => run("check", () => refreshOrder(order.order_id))}
          disabled={busy !== null}
          className="w-full bg-white text-ink border border-border rounded-lg py-2 text-[12.5px] hover:bg-bg transition-colors disabled:opacity-50"
        >
          {busy === "check" ? "Checking…" : "I've paid — check the status"}
        </button>

        {checkoutError && <span className="text-[12px] text-danger">{checkoutError}</span>}

        <span className="text-[11px] text-ink-faint text-center leading-relaxed">
          {awaiting
            ? "Waiting on Razorpay to confirm this payment. Returning from the payment page isn't proof on its own, so this stays pending until Razorpay verifies it."
            : "Real Razorpay test-mode link. This order is marked paid only once Razorpay confirms this exact order and amount."}
        </span>
      </div>
    </section>
  );
}
