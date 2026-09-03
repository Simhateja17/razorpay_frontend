"use client";

import { useState } from "react";
import { CheckoutResult } from "@/lib/types";
import { useAppState } from "@/lib/store/AppState";
import { formatINR } from "@/lib/format";

const FAILURE_STATUSES = new Set(["failed", "cancelled", "expired"]);

export default function CheckoutCard({ msgId, checkout, status }: { msgId: string; checkout: CheckoutResult; status?: string }) {
  const { checkOrderStatus, beginCheckout } = useAppState();
  const [checking, setChecking] = useState(false);

  const isPaid = status === "paid";
  const isFailed = status ? FAILURE_STATUSES.has(status) : false;
  const isPending = !isPaid && !isFailed;

  const handleCheck = async () => {
    setChecking(true);
    await checkOrderStatus(msgId, checkout.order_id);
    setChecking(false);
  };

  if (isPaid) {
    return (
      <div className="ml-9 max-w-[430px] bg-success-bg border border-success-border rounded-xl p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <span className="w-[22px] h-[22px] rounded-md bg-accent text-white flex items-center justify-center text-[12px]">✓</span>
          <span className="text-[14.5px] font-medium">Paid {formatINR(checkout.total)}</span>
        </div>
        <span className="text-[13px] text-success-ink leading-relaxed">
          Order <span className="font-mono">{checkout.order_id}</span> confirmed. Razorpay payment link <span className="font-mono">{checkout.payment_link_id}</span>.
        </span>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="ml-9 max-w-[470px] bg-danger-bg border border-danger-border rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-[22px] h-[22px] rounded-md bg-danger text-white flex items-center justify-center text-[13px] font-semibold">!</span>
          <span className="text-[14.5px] font-medium">The payment didn&apos;t go through</span>
        </div>
        <p className="m-0 text-[13.5px] leading-relaxed text-[#5d5d58]">
          Razorpay reports this payment as <span className="font-mono text-[12.5px]">{status}</span>. Nothing further was charged.
        </p>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={beginCheckout}
            className="bg-ink text-bg border-none rounded-lg px-4 py-2.5 text-[13.5px] font-medium hover:bg-black transition-colors"
          >
            Try again
          </button>
        </div>
        <span className="text-[11.5px] text-ink-faint font-mono">Logged to audit as payment_status · order {checkout.order_id}</span>
      </div>
    );
  }

  return (
    <div className="ml-9 max-w-[430px] bg-white border border-[#cfd9d5] rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 pt-4 pb-3 flex flex-col gap-2.5">
        <div className="flex justify-between items-baseline">
          <span className="font-mono text-[10px] text-ink-faint tracking-wide">CHECKOUT HANDOFF</span>
          <span className="font-mono text-[10px] text-ink-faint">RAZORPAY · TEST</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {checkout.lines.map((l) => (
            <div key={l.product_id} className="flex justify-between gap-3 text-[13px] text-[#3d3d39]">
              <span>{l.name}{l.quantity > 1 ? ` ×${l.quantity}` : ""}</span>
              <span className="font-mono text-ink">{formatINR(l.amount)}</span>
            </div>
          ))}
        </div>
        <div className="h-px bg-border-soft" />
        <div className="flex justify-between items-baseline">
          <span className="text-[13.5px] font-medium">Total payable</span>
          <span className="font-mono text-[19px] font-medium">{formatINR(checkout.total)}</span>
        </div>
      </div>
      <div className="px-4 pb-4 flex flex-col gap-2">
        <a
          href={checkout.pay_url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full text-center bg-accent text-white border-none rounded-lg py-3 text-[14px] font-medium hover:bg-accent-hover transition-colors"
        >
          Pay {formatINR(checkout.total)} via Razorpay
        </a>
        <button
          onClick={handleCheck}
          disabled={checking}
          className="w-full bg-white text-ink border border-border rounded-lg py-2 text-[12.5px] hover:bg-bg transition-colors disabled:opacity-50"
        >
          {checking ? "Checking…" : "I've completed payment — check status"}
        </button>
        <span className="text-[11px] text-ink-faint text-center">
          Real Razorpay test-mode link. Status updates here once Razorpay confirms the payment{isPending && status ? ` (currently: ${status})` : ""}.
        </span>
      </div>
    </div>
  );
}
