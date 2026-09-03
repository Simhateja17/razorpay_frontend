"use client";

import { useAppState } from "@/lib/store/AppState";
import { formatMinor } from "@/lib/format";

/**
 * The staged checkout the customer opened from the cart panel (as opposed to one the
 * agent presented mid-conversation, which `AgentComponent` draws).
 *
 * Same rules either way: the preview is exact and expiring, it holds nothing, and
 * confirming is a separate act that the host performs (ADR 0005, ADR 0012).
 */
export default function StagePanel() {
  const { stage, confirmCheckout, cancelStage, checkoutError } = useAppState();
  if (!stage) return null;

  return (
    <section className="ml-9 max-w-[430px] bg-white border border-[#cfd9d5] rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 pt-4 pb-3 flex flex-col gap-2.5">
        <div className="flex justify-between items-baseline">
          <span className="font-mono text-[10px] text-ink-faint tracking-wide">REVIEW CHECKOUT</span>
          <span className="font-mono text-[10px] text-ink-faint">
            {stage.fulfillment_option.toUpperCase()}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {stage.lines.map((line) => (
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
          <span className="text-[13.5px] font-medium">Total</span>
          <span className="font-mono text-[19px] font-medium">
            {formatMinor(stage.total_minor)}
          </span>
        </div>
        {stage.constraints_note && (
          <span className="text-[11.5px] text-ink-faint leading-relaxed">
            {stage.constraints_note}
          </span>
        )}
      </div>
      <div className="px-4 pb-4 flex flex-col gap-2">
        <button
          onClick={() => confirmCheckout(stage.stage_id)}
          className="w-full bg-accent text-white border-none rounded-lg py-3 text-[14px] font-medium hover:bg-accent-hover transition-colors"
        >
          Confirm and continue to payment
        </button>
        <button
          onClick={cancelStage}
          className="w-full bg-white text-ink border border-border rounded-lg py-2 text-[12.5px] hover:bg-bg transition-colors"
        >
          Keep shopping
        </button>
        {checkoutError && <span className="text-[12px] text-danger">{checkoutError}</span>}
        <span className="text-[11px] text-ink-faint text-center leading-relaxed">
          Confirming places the order and holds your items. Nothing is charged until you
          pay on Razorpay.
        </span>
      </div>
    </section>
  );
}
