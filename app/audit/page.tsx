"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppState } from "@/lib/store/AppState";
import { AgentKind } from "@/lib/types";

const OUTCOME_STYLE: Record<string, string> = {
  ok: "bg-surface-muted text-ink-muted border-border",
  pending_approval: "bg-upsell-bg text-upsell-ink border-upsell-border",
  approved: "bg-success-bg text-success-ink border-success-border",
  rejected: "bg-danger-bg text-danger border-danger-border",
  failed: "bg-danger-bg text-danger border-danger-border",
};

export default function AuditPage() {
  const { audit, refreshAudit } = useAppState();
  const [agentFilter, setAgentFilter] = useState<AgentKind | "all">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    void refreshAudit();
  }, [refreshAudit]);

  const rows = useMemo(() => {
    // audit already arrives newest-first (backend orders by timestamp DESC).
    return audit
      .filter((e) => agentFilter === "all" || e.agent === agentFilter)
      .filter((e) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return e.action.toLowerCase().includes(q) || e.reasoning.toLowerCase().includes(q);
      });
  }, [audit, agentFilter, query]);

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex-none px-6 pt-6 pb-4 flex flex-col gap-1">
        <h1 className="text-[20px] font-semibold tracking-tight">Audit trail</h1>
        <p className="m-0 text-[13.5px] text-ink-muted leading-relaxed max-w-[70ch]">
          Every action either agent has taken, independent of the chat transcript — what happened, why, and the outcome. This is the record that shows nothing money-moving or catalog-changing happened without being bounded, explained, or approved.
        </p>
      </div>

      <div className="flex-none px-6 pb-3 flex gap-2 items-center flex-wrap">
        <div className="flex gap-1 p-[3px] bg-surface-muted rounded-[9px]">
          {(["all", "shopping", "merchant"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAgentFilter(a)}
              className={`px-3 py-1.5 rounded-md text-[12.5px] transition-colors ${
                agentFilter === a ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              {a === "all" ? "All agents" : a === "shopping" ? "Shopping agent" : "Merchant agent"}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by action or reasoning…"
          aria-label="Filter by action or reasoning"
          className="flex-1 min-w-[200px] max-w-[320px] bg-white border border-border rounded-lg px-3 py-1.5 text-[12.5px] outline-none focus:border-accent"
        />
        <span className="font-mono text-[11px] text-ink-faint ml-auto">{rows.length} of {audit.length} entries</span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {rows.length === 0 ? (
          <div className="text-[13px] text-ink-faint py-10 text-center">
            No audit entries yet — try the storefront or merchant portal to generate some.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((e) => (
              <div key={e.id} className="rise-in bg-white border border-border-soft rounded-lg px-4 py-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10.5px] text-ink-faint whitespace-nowrap">{e.timestamp}</span>
                  <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-surface-muted text-ink-muted border border-border">
                    {e.agent === "shopping" ? "Shopping agent" : "Merchant agent"}
                  </span>
                  <span className="font-mono text-[12px] font-medium">{e.action}</span>
                  {e.gated && (
                    <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-upsell-bg text-upsell-ink border border-upsell-border">
                      gated
                    </span>
                  )}
                  <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full border ml-auto ${OUTCOME_STYLE[e.outcome]}`}>
                    {e.outcome.replace("_", " ")}
                  </span>
                </div>
                <p className="m-0 text-[12.5px] text-[#5d5d58] leading-relaxed">{e.reasoning}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
