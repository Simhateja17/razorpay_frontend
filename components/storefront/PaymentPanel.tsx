"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppState } from "@/lib/store/AppState";
import { formatMinor } from "@/lib/format";
import OriginBadge from "@/components/shared/OriginBadge";
import { OrderApi } from "@/lib/types";

/**
 * The confirmed order and its Razorpay handoff.
 *
 * The rule this panel exists to hold: **only `order.paid` renders as paid.** Coming
 * back from Razorpay is not payment — it moves the order to
 * `payment_verification_pending`, and the panel says exactly that until a verified
 * provider event proves the exact order, amount and reference were fully paid
 * (ADR 0013). A retry is a new attempt on the same order, never a second order.
 */

/**
 * What kind of record this order is, and the journey it belongs to.
 *
 * Shown on every state of the panel — paid, cancelled, waiting — because an order
 * is exactly the place a reader might otherwise assume a purchase is live when it
 * is seeded, or the reverse (ADR 0008, ADR 0032). The correlation id links to the
 * evidence for this one purchase and nothing else.
 */
function OrderProvenance({ order }: { order: OrderApi }) {
  return (
    <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border-soft mt-1">
      <span className="font-mono text-[10.5px] text-ink-faint">order {order.order_id}</span>
      <OriginBadge origin={order.origin} />
      {order.correlation_id && (
        <Link
          href="/evidence"
          className="font-mono text-[10.5px] text-ink-faint underline underline-offset-2 hover:text-ink ml-auto"
          title="Follow this purchase end to end in the evidence view"
        >
          {order.correlation_id}
        </Link>
      )}
    </div>
  );
}
/**
 * Where the outcome of the current checkout belongs.
 *
 * When the agent presented the checkout mid-conversation, its own card in the
 * transcript turns into this — the review card becomes the paid card, rather than a
 * second card appearing underneath it. A checkout the customer staged from the cart
 * has no card of its own, so it renders here at the foot of the transcript instead.
 */
export default function PaymentPanel() {
  const { checkout, checkoutStageId, storeMessages } = useAppState();
  const presentedInTranscript =
    checkoutStageId !== null &&
    storeMessages.some((message) =>
      message.components?.some(
        (component) =>
          component.kind === "checkout" && component.payload.stage_id === checkoutStageId,
      ),
    );
  if (!checkout || presentedInTranscript) return null;
  return <CheckoutStatusCard />;
}

export function CheckoutStatusCard() {
  const { checkout, refreshOrder, retryPayment, paymentReturned, checkoutError, dismissCheckout } =
    useAppState();
  const [busy, setBusy] = useState<"check" | "retry" | null>(null);

  const pollOrder = checkout?.order;
  const orderId = pollOrder?.order_id;
  const orderPaid = pollOrder?.paid;
  const orderStatus = pollOrder?.status;
  // While a payment is outstanding, poll for the webhook-verified outcome instead of
  // waiting on the customer to click "I've paid — check the status". Razorpay confirms
  // asynchronously (ADR 0013), so this is the only way a failed or succeeded webhook
  // shows up here without a manual check. Stops the moment the order reaches a
  // terminal-for-the-panel state, and pauses while the tab is hidden.
  useEffect(() => {
    if (!orderId || orderPaid || orderStatus === "cancelled" || orderStatus === "expired") {
      return;
    }
    const tick = () => {
      if (document.visibilityState === "visible") refreshOrder(orderId);
    };
    const id = window.setInterval(tick, 4000);
    return () => window.clearInterval(id);
  }, [orderId, orderStatus, orderPaid, refreshOrder]);

  if (!checkout) return null;
  const { order, payment } = checkout;

  const run = async (kind: "check" | "retry", fn: () => Promise<unknown>) => {
    setBusy(kind);
    await fn();
    setBusy(null);
  };

  if (order.paid) {
    return (
      <section id="active-checkout" className="ml-9 max-w-[430px] bg-success-bg border border-success-border rounded-xl p-4 flex flex-col gap-2">
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
        <OrderProvenance order={order} />
      </section>
    );
  }

  const terminal = order.status === "cancelled" || order.status === "expired";
  // Only the LATEST attempt's outcome describes the current situation. An order
  // keeps every attempt it has ever made, so checking "has any attempt ever
  // failed" would keep this panel showing "declined" forever after the very
  // first decline — including once a fresh attempt exists and just needs its
  // link, or once that fresh attempt has already been paid.
  const latestAttempt = order.attempts[order.attempts.length - 1];
  const declined = latestAttempt?.status === "failed" && !terminal;
  const awaiting = order.status === "payment_verification_pending";

  if (terminal) {
    return (
      <section id="active-checkout" className="ml-9 max-w-[470px] bg-danger-bg border border-danger-border rounded-xl p-4 flex flex-col gap-2">
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
        <OrderProvenance order={order} />
      </section>
    );
  }

  return (
    <section id="active-checkout" className="ml-9 max-w-[430px] bg-white border border-[#cfd9d5] rounded-xl overflow-hidden shadow-sm">
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
            the items it&apos;s holding are still here — try again below.
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
        {/* A declined attempt's link is dead at the provider — Razorpay itself would
            show it as cancelled. So the primary action here is always a fresh
            attempt, not the old link; `retryPayment` opens a new attempt on the
            same order rather than a new order (ADR 0030). */}
        {declined ? (
          <button
            onClick={() => run("retry", () => retryPayment(order.order_id))}
            disabled={busy !== null}
            className="w-full bg-accent text-white border-none rounded-lg py-3 text-[14px] font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {busy === "retry" ? "Starting a new attempt…" : "Try again"}
          </button>
        ) : payment.pay_url ? (
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

        {awaiting && (
          <button
            onClick={() => run("check", () => refreshOrder(order.order_id))}
            disabled={busy !== null}
            className="w-full bg-white text-ink border border-border rounded-lg py-2 text-[12.5px] hover:bg-bg transition-colors disabled:opacity-50"
          >
            {busy === "check" ? "Checking…" : "Check now"}
          </button>
        )}

        {checkoutError && <span className="text-[12px] text-danger">{checkoutError}</span>}

        <span className="text-[11px] text-ink-faint text-center leading-relaxed">
          {/* `declined` and `awaiting` can both be true at once — the order can sit
              in payment_verification_pending with its most recent attempt failed,
              since a decline settles the attempt without moving the order back to
              pending_payment. A failed attempt is a definite outcome, so it takes
              priority over "still waiting": telling the customer their card was
              declined while also saying "hang on, we're waiting to hear back" would
              contradict itself. */}
          {declined
            ? "That attempt failed. A new attempt starts fresh — nothing from the failed one carries over or gets charged twice."
            : awaiting
              ? "Waiting on Razorpay to confirm this payment. We're checking automatically — no need to refresh."
              : "Real Razorpay test-mode link. This order is marked paid only once Razorpay confirms this exact order and amount, and this page updates on its own once it does."}
        </span>
      </div>
      <OrderProvenance order={order} />
    </section>
  );
}
