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

export default function JourneyView({ journey }: { journey: Journey | null }) {
  if (!journey) {
    return (
      <div className="text-[13px] text-ink-faint py-10 text-center">
        Select a journey to follow it end to end.
      </div>
    );
  }
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

      <ol className="flex flex-col gap-1.5 m-0 p-0 list-none">
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
    </div>
  );
}
