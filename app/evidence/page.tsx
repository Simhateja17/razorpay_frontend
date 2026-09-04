"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppState } from "@/lib/store/AppState";
import { api } from "@/lib/api";
import { EvidenceOutcome, Journey } from "@/lib/types";
import OriginBadge from "@/components/shared/OriginBadge";
import JourneyView from "@/components/shared/JourneyView";
import RoleGate from "@/components/shared/RoleGate";

/**
 * The customer's own evidence, and the journeys inside it.
 *
 * This replaces the audit trail page, which read the flat `audit` table: one row
 * per action, no principal filter, no correlation and no origin, so it showed every
 * session at once and could not answer "what happened on *my* purchase". This page
 * reads `evidence_records` through `/evidence`, where the principal filter is
 * applied by the server from the verified token and is not a parameter a client can
 * widen (ADR 0023, ADR 0032).
 */
const OUTCOME_STYLE: Record<EvidenceOutcome, string> = {
  applied: "bg-success-bg text-success-ink border-success-border",
  blocked: "bg-danger-bg text-danger border-danger-border",
  failed: "bg-danger-bg text-danger border-danger-border",
  conflict: "bg-upsell-bg text-upsell-ink border-upsell-border",
  unavailable: "bg-surface-muted text-ink-muted border-border",
};

/** A ledger timestamp, readable. The raw value keeps microseconds for ordering. */
function stamp(at: string): string {
  const parsed = new Date(at);
  return Number.isNaN(parsed.getTime()) ? at : parsed.toLocaleString();
}

const OUTCOMES: (EvidenceOutcome | "all")[] = [
  "all", "applied", "blocked", "failed", "conflict", "unavailable",
];

export default function EvidencePage() {
  return (
    <RoleGate role="customer">
      <CustomerEvidencePage />
    </RoleGate>
  );
}

function CustomerEvidencePage() {
  const { evidence, refreshEvidence } = useAppState();
  const [outcome, setOutcome] = useState<EvidenceOutcome | "all">("all");
  const [query, setQuery] = useState("");
  const [thisRunOnly, setThisRunOnly] = useState(true);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [journeyError, setJourneyError] = useState<string | null>(null);

  useEffect(() => {
    void refreshEvidence();
  }, [refreshEvidence]);

  const openJourney = useCallback(async (correlationId: string) => {
    setJourneyError(null);
    try {
      setJourney(await api.myJourney(correlationId));
    } catch {
      setJourney(null);
      setJourneyError("That journey could not be loaded.");
    }
  }, []);

  const runId = api.demoRunId();

  const rows = useMemo(
    () =>
      evidence
        .filter((row) => outcome === "all" || row.outcome === outcome)
        .filter((row) => !thisRunOnly || row.demo_run_id === runId)
        .filter((row) => {
          const q = query.trim().toLowerCase();
          if (!q) return true;
          return (
            row.action.toLowerCase().includes(q) || row.reason.toLowerCase().includes(q)
          );
        }),
    [evidence, outcome, query, thisRunOnly, runId]
  );

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex-none px-6 pt-6 pb-4 flex flex-col gap-1">
        <h1 className="text-[20px] font-semibold tracking-tight">Evidence</h1>
        <p className="m-0 text-[13.5px] text-ink-muted leading-relaxed max-w-[70ch]">
          Every meaningful thing done on your account — what happened, why, and how it
          ended, including the refusals. These are your own records: the server filters
          to your verified principal, so nobody else&apos;s session appears here. Select a
          row to follow its whole journey, from the request through to the Razorpay
          evidence.
        </p>
      </div>

      <div className="flex-none px-6 pb-3 flex gap-2 items-center flex-wrap">
        <div className="flex gap-1 p-[3px] bg-surface-muted rounded-[9px]">
          {OUTCOMES.map((value) => (
            <button
              key={value}
              onClick={() => setOutcome(value)}
              className={`px-3 py-1.5 rounded-md text-[12.5px] transition-colors ${
                outcome === value ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              {value === "all" ? "All outcomes" : value}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
          <input
            type="checkbox"
            checked={thisRunOnly}
            onChange={(e) => setThisRunOnly(e.target.checked)}
          />
          This session only
        </label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by action or reason…"
          aria-label="Filter by action or reason"
          className="flex-1 min-w-[200px] max-w-[320px] bg-white border border-border rounded-lg px-3 py-1.5 text-[12.5px] outline-none focus:border-accent"
        />
        <span className="font-mono text-[11px] text-ink-faint ml-auto">
          {rows.length} of {evidence.length} records
        </span>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4 px-6 pb-6">
        <div className="overflow-y-auto">
          {rows.length === 0 ? (
            <div className="text-[13px] text-ink-faint py-10 text-center">
              Nothing recorded yet — shop in the storefront to produce some.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => row.correlation_id && openJourney(row.correlation_id)}
                  className="rise-in text-left bg-white border border-border-soft rounded-lg px-4 py-3 flex flex-col gap-1.5 hover:border-border transition-colors"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10.5px] text-ink-faint whitespace-nowrap">
                      {stamp(row.recorded_at)}
                    </span>
                    <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-surface-muted text-ink-muted border border-border">
                      {row.actor_type}
                    </span>
                    <span className="font-mono text-[12px] font-medium">{row.action}</span>
                    <OriginBadge origin={row.data_origin} />
                    <span
                      className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full border ml-auto ${OUTCOME_STYLE[row.outcome]}`}
                    >
                      {row.outcome}
                    </span>
                  </div>
                  <p className="m-0 text-[12.5px] text-[#5d5d58] leading-relaxed">{row.reason}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-y-auto bg-surface border border-border-soft rounded-lg p-4">
          <h2 className="m-0 mb-3 text-[14px] font-semibold tracking-tight">Journey</h2>
          {journeyError ? (
            <div className="text-[13px] text-danger py-6 text-center">{journeyError}</div>
          ) : (
            <JourneyView journey={journey} />
          )}
        </div>
      </div>
    </div>
  );
}
