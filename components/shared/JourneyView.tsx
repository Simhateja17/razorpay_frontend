"use client";

import { Journey, JourneyStep, JourneyStepSource } from "@/lib/types";
import OriginBadge from "@/components/shared/OriginBadge";
import { formatMinor } from "@/lib/format";

/**
 * One journey, from the customer's request to the Razorpay evidence.
 *
 * This is the view the Phase 7 acceptance is actually about: a judge follows one
 * purchase — or one refusal — end to end, in order, without joining rows by eye.
 * The six sources are labelled rather than flattened, because "the model called a
 * tool", "the database moved an order" and "the provider said this" are different
 * kinds of fact and a reader has to be able to tell them apart.
 */
const SOURCE_LABEL: Record<JourneyStepSource, string> = {
  evidence: "Ledger",
  turn: "Agent turn",
  tool: "Tool call",
  order: "Order",
  payment_attempt: "Payment",
  provider_event: "Razorpay",
};

const SOURCE_STYLE: Record<JourneyStepSource, string> = {
  evidence: "bg-surface-muted text-ink-muted border-border",
  turn: "bg-success-bg text-accent border-success-border",
  tool: "bg-surface-muted text-ink-muted border-border",
  order: "bg-success-bg text-success-ink border-success-border",
  payment_attempt: "bg-upsell-bg text-upsell-ink border-upsell-border",
  provider_event: "bg-upsell-bg text-upsell-ink border-upsell-border",
};

const OUTCOME_STYLE: Record<string, string> = {
  applied: "bg-success-bg text-success-ink border-success-border",
  blocked: "bg-danger-bg text-danger border-danger-border",
  failed: "bg-danger-bg text-danger border-danger-border",
  conflict: "bg-upsell-bg text-upsell-ink border-upsell-border",
  unavailable: "bg-surface-muted text-ink-muted border-border",
};

function clock(at: string | null): string {
  if (!at) return "—";
  const parsed = new Date(at);
  return Number.isNaN(parsed.getTime()) ? at : parsed.toLocaleTimeString();
}

/** The one or two facts from a step worth showing without expanding it. */
function summary(step: JourneyStep): string | null {
  const detail = step.detail as Record<string, string | number | null>;
  if (step.source === "tool" && detail.latency_ms != null) return `${detail.latency_ms} ms`;
  if (step.source === "order" && detail.total_minor != null)
    return formatMinor(Number(detail.total_minor));
  if (step.source === "payment_attempt" && detail.provider_reference)
    return String(detail.provider_reference);
  if (step.source === "provider_event" && detail.quarantine_reason)
    return String(detail.quarantine_reason);
  if (step.source === "turn" && detail.user_message) return String(detail.user_message);
  return null;
}

type StoryStep = { label: string; detail: string; state: "done" | "waiting" | "problem" };

function purchaseStory(steps: JourneyStep[]): StoryStep[] {
  const story: StoryStep[] = [];
  const turn = steps.find(step => step.source === "turn" && step.detail.user_message);
  if (turn) story.push({ label: "You requested", detail: String(turn.detail.user_message), state: "done" });
  const compatibility = steps.find(step => step.source === "tool" && step.label === "check_compatibility");
  if (compatibility) story.push({
    label: compatibility.outcome === "applied" ? "Compatibility checked" : "Compatibility check stopped",
    detail: compatibility.outcome === "applied" ? "The selected products were checked against recorded compatibility rules." : "The check did not approve this combination.",
    state: compatibility.outcome === "applied" ? "done" : "problem",
  });
  const confirmed = steps.find(step => step.source === "evidence" && step.label === "confirm_checkout" && step.outcome === "applied");
  if (confirmed) story.push({ label: "You approved the total", detail: String(confirmed.detail.reason ?? "The reviewed checkout was confirmed."), state: "done" });
  const attempt = [...steps].reverse().find(step => step.source === "payment_attempt");
  if (attempt) {
    const status = String(attempt.detail.status ?? "pending");
    story.push({
      label: status === "failed" ? "Payment needs another try" : status === "succeeded" ? "Payment received" : "Awaiting payment",
      detail: status === "failed" ? String(attempt.detail.failure_reason ?? "The payment attempt failed without charging the order.") : "Razorpay test mode is handling this payment attempt.",
      state: status === "failed" ? "problem" : status === "succeeded" ? "done" : "waiting",
    });
  }
  const paid = steps.find(step => step.source === "order" && step.detail.status === "paid");
  const verifying = steps.find(step => step.source === "order" && step.detail.status === "payment_verification_pending");
  if (paid) story.push({ label: "Payment verified", detail: `Razorpay evidence matched this order and ${formatMinor(Number(paid.detail.amount_paid_minor ?? 0))} was verified.`, state: "done" });
  else if (verifying) story.push({ label: "Verifying payment", detail: "The customer returned; Cartisan is waiting for verified Razorpay evidence.", state: "waiting" });
  return story;
}

export default function JourneyView({ journey }: { journey: Journey | null }) {
  if (!journey) {
    return (
      <div className="text-[13px] text-ink-faint py-10 text-center">
        Select a journey to follow it end to end.
      </div>
    );
  }
  const story = purchaseStory(journey.steps);
  if (!journey.found) {
    return (
      <div className="text-[13px] text-ink-faint py-10 text-center">
        No records for that correlation id.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[11px] text-ink-faint">{journey.correlation_id}</span>
        {(journey.origins ?? []).map((origin) => (
          <OriginBadge key={origin} origin={origin} />
        ))}
        {journey.demo_run_id && (
          <span className="font-mono text-[10.5px] text-ink-faint border border-border rounded-full px-2 py-0.5">
            {journey.demo_run_id}
          </span>
        )}
        <span className="font-mono text-[11px] text-ink-faint ml-auto">
          {journey.steps.length} steps
        </span>
      </div>

      {story.length > 0 && <ol aria-label="Purchase timeline" className="flex flex-col gap-2 m-0 p-0 list-none">
        {story.map((step, index) => <li key={`${step.label}-${index}`} className="relative pl-8 pb-2">
          {index < story.length - 1 && <span aria-hidden="true" className="absolute left-[10px] top-5 bottom-[-9px] w-px bg-border" />}
          <span aria-hidden="true" className={`absolute left-0 top-0.5 w-[21px] h-[21px] rounded-full grid place-items-center text-[11px] ${step.state === "done" ? "bg-accent text-white" : step.state === "problem" ? "bg-danger text-white" : "bg-upsell-bg text-upsell-ink"}`}>{step.state === "done" ? "✓" : step.state === "problem" ? "!" : "…"}</span>
          <h3 className="m-0 text-[13px] font-semibold">{step.label}</h3>
          <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted leading-relaxed">{step.detail}</p>
        </li>)}
      </ol>}

      <details className="border-t border-border-soft pt-3">
        <summary className="cursor-pointer text-[12px] font-medium text-ink-muted">Technical evidence · {journey.steps.length} records</summary>
      <ol className="flex flex-col gap-1.5 mt-3 p-0 list-none">
        {journey.steps.map((step, index) => (
          <li
            key={`${step.source}-${index}`}
            className="bg-white border border-border-soft rounded-lg px-3 py-2 flex flex-col gap-1"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10.5px] text-ink-faint whitespace-nowrap">
                {clock(step.at)}
              </span>
              <span
                className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full border ${SOURCE_STYLE[step.source]}`}
              >
                {SOURCE_LABEL[step.source]}
              </span>
              <span className="font-mono text-[12px] font-medium">{step.label}</span>
              <OriginBadge origin={step.origin} />
              {step.outcome && (
                <span
                  className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full border ml-auto ${
                    OUTCOME_STYLE[step.outcome] ?? OUTCOME_STYLE.unavailable
                  }`}
                >
                  {step.outcome}
                </span>
              )}
            </div>
            {summary(step) && (
              <p className="m-0 text-[12.5px] text-[#5d5d58] leading-relaxed">{summary(step)}</p>
            )}
            {typeof (step.detail as { reason?: string }).reason === "string" && (
              <p className="m-0 text-[12.5px] text-[#5d5d58] leading-relaxed">
                {(step.detail as { reason: string }).reason}
              </p>
            )}
          </li>
        ))}
      </ol>
      </details>
    </div>
  );
}
