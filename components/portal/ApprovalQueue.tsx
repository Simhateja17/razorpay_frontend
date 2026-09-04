"use client";

import { useAppState } from "@/lib/store/AppState";
import { MerchantChange, MerchantChangeStatus } from "@/lib/types";
import { formatMinor } from "@/lib/format";

/**
 * The approval surface.
 *
 * This pane is the whole of the operator's authority over what the agent proposed.
 * The agent can put a row here and can do nothing else to it: `pending` is the only
 * status a model-reachable path produces, and Approve is what asks the host to
 * re-check the bounds against current figures and write (ADR 0016).
 *
 * A row can therefore come back `failed`, and that is worth showing plainly: the
 * change was approved and then refused at the moment of writing, because the record
 * had moved or a bound no longer held. Hiding that would leave an operator believing
 * they had changed something they had not.
 */
const MONEY_KEYS = new Set(["amount_minor", "budget_minor", "min_subtotal_minor"]);

function fmtValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (MONEY_KEYS.has(key) && typeof value === "number") return formatMinor(value);
  if (key === "units" && typeof value === "number") return value > 0 ? `+${value}` : String(value);
  return String(value);
}

function fmtSide(doc: Record<string, unknown>): string {
  const entries = Object.entries(doc);
  if (entries.length === 0) return "new";
  return entries.map(([k, v]) => `${k.replace(/_minor$/, "")}: ${fmtValue(k, v)}`).join(", ");
}

function kindLabel(kind: string): string {
  return kind.split("_").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

const BADGE: Record<MerchantChangeStatus, { text: string; tone: string }> = {
  pending: { text: "PENDING", tone: "text-ink-faint" },
  approved: { text: "Approved", tone: "bg-success-bg text-success-ink border border-success-border" },
  applied: { text: "Applied", tone: "bg-success-bg text-success-ink border border-success-border" },
  rejected: { text: "Rejected", tone: "bg-danger-bg text-danger border border-danger-border" },
  failed: { text: "Refused at apply", tone: "bg-danger-bg text-danger border border-danger-border" },
  superseded: { text: "Superseded", tone: "bg-surface-muted text-ink-faint border border-border" },
};

function Row({ item }: { item: MerchantChange }) {
  const { decideChange } = useAppState();
  const pending = item.status === "pending";
  const badge = BADGE[item.status];
  const note = item.approvals[item.approvals.length - 1]?.note;

  return (
    <div
      className={`rise-in flex flex-col gap-2 rounded-lg border p-3 ${
        pending ? "border-border bg-white" : "border-border-soft bg-surface-muted"
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <span className="text-[13px] font-medium leading-snug">
          {kindLabel(item.kind)}
          {item.target_id ? ` · ${item.target_id}` : ""}
        </span>
        <span
          className={
            pending
              ? `flex-none font-mono text-[10px] ${badge.tone}`
              : `flex-none text-[10.5px] font-medium px-2 py-0.5 rounded-full ${badge.tone}`
          }
        >
          {badge.text}
        </span>
      </div>

      {/* The exact documents the agent staged, which are the documents the host
          re-validates and writes. What is shown here is what gets approved. */}
      <div className="flex items-center gap-2 text-[12.5px] flex-wrap">
        <span className="text-ink-faint line-through">{fmtSide(item.before)}</span>
        <span className="text-ink-faint">→</span>
        <span className="font-medium text-ink">{fmtSide(item.after)}</span>
      </div>

      <p className="m-0 text-[11.5px] text-ink-muted leading-relaxed">{item.rationale}</p>

      {item.status === "failed" && (
        <p className="m-0 text-[11.5px] text-danger leading-relaxed">
          Approved, then refused at the moment of writing: the record had moved or a bound
          no longer held. Nothing was changed. Ask the agent to stage it again against
          current figures.
        </p>
      )}
      {note && <p className="m-0 text-[11px] text-ink-faint leading-relaxed">Note: {note}</p>}

      {pending && (
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => decideChange(item.id, "approved")}
            className="flex-1 bg-accent text-white text-[12.5px] font-medium rounded-md py-1.5 hover:bg-accent-hover transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => decideChange(item.id, "rejected")}
            className="flex-1 bg-white border border-border text-ink text-[12.5px] rounded-md py-1.5 hover:bg-bg transition-colors"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

export default function ApprovalQueue() {
  const { changes, decisionError } = useAppState();
  const pending = changes.filter((c) => c.status === "pending");
  const decided = changes.filter((c) => c.status !== "pending");

  return (
    <aside className="w-[320px] flex-none bg-white border-l border-border flex flex-col">
      <div className="px-4 pt-3.5 pb-3 border-b border-border-soft flex flex-col gap-0.5">
        <span className="text-[13.5px] font-semibold">Pending your approval</span>
        <span className="text-[11.5px] text-ink-faint leading-snug">
          Nothing here is live. The assistant can queue a change and nothing else; each one
          applies only when you approve it, and only if it still passes its bounds.
        </span>
      </div>

      {decisionError && (
        <div className="mx-3 mt-3 bg-danger-bg border border-danger-border rounded-lg px-2.5 py-2 text-[11.5px] text-[#5d5d58] leading-relaxed">
          {decisionError}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
        {pending.length === 0 && decided.length === 0 && (
          <span className="text-[12.5px] text-ink-faint leading-relaxed">
            No changes queued. Ask the assistant about stock, pricing, or a promotion, and
            anything it proposes will land here for you to decide on.
          </span>
        )}
        {pending.map((item) => (
          <Row key={item.id} item={item} />
        ))}
        {decided.length > 0 && (
          <>
            <div className="text-[10.5px] font-mono text-ink-faint tracking-wide mt-2 mb-0.5">
              DECIDED
            </div>
            {decided.map((item) => (
              <Row key={item.id} item={item} />
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
