"use client";

import { useAppState } from "@/lib/store/AppState";
import { Approval } from "@/lib/types";

function fmtSide(obj: Record<string, unknown>): string {
  const entries = Object.entries(obj);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
}

function kindLabel(kind: string): string {
  return kind
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function Row({ item }: { item: Approval }) {
  const { decideApproval } = useAppState();
  const decided = item.status !== "pending";

  return (
    <div className={`rise-in flex flex-col gap-2 rounded-lg border p-3 ${decided ? "border-border-soft bg-surface-muted" : "border-border bg-white"}`}>
      <div className="flex justify-between items-start gap-2">
        <span className="text-[13px] font-medium leading-snug">
          {kindLabel(item.kind)}
          {item.target_id ? ` · ${item.target_id}` : ""}
        </span>
        {decided ? (
          <span
            className={`flex-none text-[10.5px] font-medium px-2 py-0.5 rounded-full ${
              item.status === "approved" ? "bg-success-bg text-success-ink border border-success-border" : "bg-danger-bg text-danger border border-danger-border"
            }`}
          >
            {item.status === "approved" ? "Applied" : "Rejected, agent notified"}
          </span>
        ) : (
          <span className="flex-none font-mono text-[10px] text-ink-faint">PENDING</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-[12.5px] flex-wrap">
        <span className="text-ink-faint line-through">{fmtSide(item.before)}</span>
        <span className="text-ink-faint">→</span>
        <span className="font-medium text-ink">{fmtSide(item.after)}</span>
      </div>
      <p className="m-0 text-[11.5px] text-ink-muted leading-relaxed">{item.reasoning}</p>
      {!decided && (
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => decideApproval(item.id, "approved")}
            className="flex-1 bg-accent text-white text-[12.5px] font-medium rounded-md py-1.5 hover:bg-accent-hover transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => decideApproval(item.id, "rejected")}
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
  const { approvals } = useAppState();
  const pending = approvals.filter((a) => a.status === "pending");
  const decided = approvals.filter((a) => a.status !== "pending");

  return (
    <aside className="w-[320px] flex-none bg-white border-l border-border flex flex-col">
      <div className="px-4 pt-3.5 pb-3 border-b border-border-soft flex flex-col gap-0.5">
        <span className="text-[13.5px] font-semibold">Pending your approval</span>
        <span className="text-[11.5px] text-ink-faint leading-snug">
          Nothing here is live. Each change applies only when you click Approve.
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
        {pending.length === 0 && decided.length === 0 && (
          <span className="text-[12.5px] text-ink-faint leading-relaxed">
            No proposed changes yet. The chat here currently only reports on the business — it doesn&apos;t queue changes automatically. Use the API directly (<code className="font-mono">POST /portal/approvals</code>) to propose one for testing.
          </span>
        )}
        {pending.map((item) => (
          <Row key={item.id} item={item} />
        ))}
        {decided.length > 0 && (
          <>
            <div className="text-[10.5px] font-mono text-ink-faint tracking-wide mt-2 mb-0.5">DECIDED</div>
            {decided.map((item) => (
              <Row key={item.id} item={item} />
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
