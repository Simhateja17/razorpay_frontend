"use client";

import { useState } from "react";
import { CheckoutStage } from "@/lib/types";
import { useAppState } from "@/lib/store/AppState";
import { formatINR } from "@/lib/format";

export default function CheckoutStageCard({ stage }: { stage: CheckoutStage }) {
  const { beginCheckout } = useAppState();
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = async () => {
    setSubmitting(true);
    await beginCheckout();
    setSubmitting(false);
  };

  return (
    <div className="ml-9 max-w-[430px] bg-white border border-[#cfd9d5] rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 pt-4 pb-3 flex flex-col gap-2.5">
        <span className="font-mono text-[10px] text-ink-faint tracking-wide">REVIEW CHECKOUT</span>
        <div className="flex flex-col gap-1.5">
          {stage.lines.map((line) => (
            <div key={line.product_id} className="flex justify-between gap-3 text-[13px] text-[#3d3d39]">
              <span>{line.name}{line.quantity > 1 ? ` ×${line.quantity}` : ""}</span>
              <span className="font-mono text-ink">{formatINR(line.amount)}</span>
            </div>
          ))}
        </div>
        <div className="h-px bg-border-soft" />
        <div className="flex justify-between items-baseline">
          <span className="text-[13.5px] font-medium">Total</span>
          <span className="font-mono text-[19px] font-medium">{formatINR(stage.total)}</span>
        </div>
      </div>
      <div className="px-4 pb-4 flex flex-col gap-2">
        <button onClick={handleContinue} disabled={submitting}
          className="w-full bg-accent text-white border-none rounded-lg py-3 text-[14px] font-medium hover:bg-accent-hover transition-colors disabled:opacity-50">
          {submitting ? "Creating secure link…" : "Continue to Razorpay"}
        </button>
        <span className="text-[11px] text-ink-faint text-center">
          Nothing is ordered or charged until you continue and complete payment on Razorpay.
        </span>
      </div>
    </div>
  );
}
