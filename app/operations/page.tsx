"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  DemoRun,
  HealthReport,
  Journey,
  JourneySummary,
  RecoveryQueue,
  Claim,
} from "@/lib/types";
import { useAppState } from "@/lib/store/AppState";
import OriginBadge from "@/components/shared/OriginBadge";
import JourneyView from "@/components/shared/JourneyView";
import { formatMinor } from "@/lib/format";

/**
 * The operator's observability surface: journeys, production health, and the two
 * stuck states the payment path can reach.
 *
 * It is deliberately not the portal chat. The portal is where an operator talks to
 * the merchant agent and approves what it proposes; this is where they check what
 * the whole system has been doing — including things no agent was involved in, like
 * a dead-lettered payment link or a quarantined callback.
 *
 * Nothing here can be acted on from the browser. Every recovery control is behind
 * the operations token, host-triggered by design (ADR 0005), so this page shows what
 * is wrong, what it is attached to, and the exact command that fixes it.
 */
type Tab = "journeys" | "health" | "recovery";

function claimValue(claim: Claim): string {
  if (claim.value === null) return "—";
  if (claim.value_label) return claim.value_label;
  if (claim.unit === "ratio") return `${(Number(claim.value) * 100).toFixed(1)}%`;
  if (claim.unit === "milliseconds") return `${claim.value} ms`;
  return String(claim.value);
}

function ClaimTile({ claim }: { claim: Claim }) {
  // The formula and the operands sit on the tile itself. A figure a reader cannot
  // check is a figure asking to be trusted, and Cartisan's are meant to be checked.
  const title = [
    claim.basis,
    ...Object.entries(claim.inputs).map(([k, v]) => `${k}: ${JSON.stringify(v)}`),
    ...claim.limitations,
  ].join("\n");
  const unwindowed = claim.inputs?.window_hours === null;
  return (
    <div
      title={title}
      className="bg-white border border-border-soft rounded-lg px-4 py-3 flex flex-col gap-1"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[19px] font-semibold tracking-tight">{claimValue(claim)}</span>
        {unwindowed && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-upsell-bg text-upsell-ink border border-upsell-border"
            title="Covers all recorded history, not this window."
          >
            all time
          </span>
        )}
      </div>
      <span className="text-[12px] text-ink-muted">{claim.key.replace(/_/g, " ")}</span>
      <span className="font-mono text-[10.5px] text-ink-faint leading-snug">{claim.basis}</span>
      {claim.limitations.map((note) => (
        <span key={note} className="text-[11px] text-ink-faint leading-snug">
          {note}
        </span>
      ))}
    </div>
  );
}

export default function OperationsPage() {
  const { session } = useAppState();
  const [tab, setTab] = useState<Tab>("journeys");
  const [demoRuns, setDemoRuns] = useState<DemoRun[]>([]);
  const [demoRun, setDemoRun] = useState<string>("");
  const [journeys, setJourneys] = useState<JourneySummary[]>([]);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [recovery, setRecovery] = useState<RecoveryQueue | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const filters = await api.evidenceFilters();
      setDemoRuns(filters.demo_runs);
      setJourneys(await api.journeys({ demoRunId: demoRun || undefined, limit: 40 }));
      setHealth(await api.health(24, demoRun || undefined));
      setRecovery(await api.recoveryQueue());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load operations data.");
    }
  }, [demoRun]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  const openJourney = useCallback(async (correlationId: string) => {
    try {
      setJourney(await api.journey(correlationId));
    } catch {
      setJourney(null);
    }
  }, []);

  if (!session) {
    return (
      <div className="h-full flex items-center justify-center text-[13px] text-ink-faint">
        Sign in with an operator account to see operations.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex-none px-6 pt-6 pb-4 flex flex-col gap-1">
        <h1 className="text-[20px] font-semibold tracking-tight">Operations</h1>
        <p className="m-0 text-[13.5px] text-ink-muted leading-relaxed max-w-[70ch]">
          What the whole system has been doing: every journey from a customer request
          through to the Razorpay evidence, how the runtime and the payment path are
          holding up, and anything currently stuck. Filter to one demo run to exclude
          every other session.
        </p>
      </div>

      <div className="flex-none px-6 pb-3 flex gap-2 items-center flex-wrap">
        <div className="flex gap-1 p-[3px] bg-surface-muted rounded-[9px]">
          {(["journeys", "health", "recovery"] as Tab[]).map((value) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`px-3 py-1.5 rounded-md text-[12.5px] capitalize transition-colors ${
                tab === value ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <select
          value={demoRun}
          onChange={(e) => setDemoRun(e.target.value)}
          aria-label="Demo run"
          className="bg-white border border-border rounded-lg px-3 py-1.5 text-[12.5px] outline-none focus:border-accent"
        >
          <option value="">All demo runs</option>
          {demoRuns.map((run) => (
            <option key={run.demo_run_id} value={run.demo_run_id}>
              {run.demo_run_id} ({run.journeys} journeys)
            </option>
          ))}
        </select>
        <button
          onClick={() => void load()}
          className="text-[12.5px] text-ink-muted hover:text-ink underline underline-offset-2"
        >
          Refresh
        </button>
        {error && <span className="text-[12.5px] text-danger">{error}</span>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        {tab === "journeys" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              {journeys.length === 0 && (
                <div className="text-[13px] text-ink-faint py-10 text-center">
                  No journeys recorded for this filter.
                </div>
              )}
              {journeys.map((row) => (
                <button
                  key={row.correlation_id}
                  onClick={() => openJourney(row.correlation_id)}
                  className="text-left bg-white border border-border-soft rounded-lg px-4 py-3 flex flex-col gap-1.5 hover:border-border transition-colors"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10.5px] text-ink-faint">
                      {row.correlation_id}
                    </span>
                    {row.origins.map((origin) => (
                      <OriginBadge key={origin} origin={origin} />
                    ))}
                    {(row.blocked > 0 || row.failed > 0) && (
                      <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-danger-bg text-danger border border-danger-border ml-auto">
                        {row.blocked + row.failed} refused
                      </span>
                    )}
                  </div>
                  <p className="m-0 text-[12.5px] text-[#5d5d58]">
                    {row.started_by.actor_type ?? "—"} · {row.first_action ?? "—"} ·{" "}
                    {row.records} records
                    {row.orders.length > 0 &&
                      ` · order ${row.orders[0].status} ${formatMinor(row.orders[0].total_minor)}`}
                  </p>
                </button>
              ))}
            </div>
            <div className="bg-surface border border-border-soft rounded-lg p-4">
              <JourneyView journey={journey} />
            </div>
          </div>
        )}

        {tab === "health" && health && (
          <div className="flex flex-col gap-5">
            <p className="m-0 text-[12.5px] text-ink-faint">
              Window: last {health.window_hours} hours
              {health.demo_run_id ? ` · ${health.demo_run_id}` : ""}. Hover any figure for
              its formula and operands.
            </p>
            {(["runtime", "tools", "payments", "delivery"] as const).map((group) => (
              <section key={group} className="flex flex-col gap-2">
                <h2 className="m-0 text-[13px] font-semibold capitalize tracking-tight">
                  {group}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {health[group].map((claim) => (
                    <ClaimTile key={claim.key} claim={claim} />
                  ))}
                </div>
              </section>
            ))}
            <section className="flex flex-col gap-2">
              <h2 className="m-0 text-[13px] font-semibold tracking-tight">Per tool</h2>
              <div className="bg-white border border-border-soft rounded-lg overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="text-ink-faint">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Tool</th>
                      <th className="text-left font-medium px-3 py-2">Outcome</th>
                      <th className="text-right font-medium px-3 py-2">Calls</th>
                      <th className="text-right font-medium px-3 py-2">Mean latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {health.tool_outcomes.map((row) => (
                      <tr key={`${row.tool_name}-${row.outcome}`} className="border-t border-border-soft">
                        <td className="px-3 py-2 font-mono">{row.tool_name}</td>
                        <td className="px-3 py-2">{row.outcome}</td>
                        <td className="px-3 py-2 text-right">{row.count}</td>
                        <td className="px-3 py-2 text-right">
                          {Math.round(row.mean_latency_ms)} ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="flex flex-col gap-2">
              <h2 className="m-0 text-[13px] font-semibold tracking-tight">Evidence by origin</h2>
              <div className="flex gap-2 flex-wrap">
                {health.origins.map((row) => (
                  <span
                    key={row.data_origin}
                    className="flex items-center gap-2 bg-white border border-border-soft rounded-lg px-3 py-2 text-[12.5px]"
                  >
                    <OriginBadge origin={row.data_origin} />
                    {row.count}
                  </span>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === "recovery" && recovery && (
          <div className="flex flex-col gap-5">
            <p className="m-0 text-[12.5px] text-ink-faint max-w-[70ch] leading-relaxed">
              Recovery controls are host-triggered and behind the operations token, never
              reachable from the browser or from a model (ADR 0005). Each item below shows
              the command that resolves it.
            </p>

            <RecoverySection
              title="Dead-lettered effects"
              blurb="An external effect that was scheduled, committed, and never delivered. The order behind it is real and its stock is really held."
              empty="Nothing parked."
              rows={recovery.dead_letters.map((row) => ({
                key: row.message_id,
                heading: `${row.topic} · ${row.attempts} attempts`,
                body: row.last_error ?? "",
                correlationId: row.correlation_id,
                command: `curl -X POST -H "X-Cartisan-Ops-Token: $CARTISAN_OPS_TOKEN" $API/admin/recovery/messages/${row.message_id}/retry`,
              }))}
            />

            <RecoverySection
              title="Quarantined provider events"
              blurb="A callback that did not match the order it claimed. It is never re-applied — a payload that failed verification stays refused, and the recovery is on the order (ADR 0013)."
              empty="Nothing quarantined."
              rows={recovery.quarantined.map((row) => ({
                key: row.inbox_id,
                heading: `${row.event_type} · ${row.provider_event_id}`,
                body: row.quarantine_reason ?? "",
                correlationId: row.correlation_id,
                command: `curl -X POST -H "X-Cartisan-Ops-Token: $CARTISAN_OPS_TOKEN" -H "Content-Type: application/json" -d '{"note":"reviewed"}' $API/admin/recovery/events/${row.inbox_id}/acknowledge`,
              }))}
            />

            <RecoverySection
              title="Events never decided"
              blurb="Stored but not yet applied or refused — a delivery interrupted mid-flight. These can be re-run through the ordinary verification."
              empty="Nothing waiting."
              rows={recovery.unprocessed.map((row) => ({
                key: row.inbox_id,
                heading: `${row.event_type} · ${row.provider_event_id}`,
                body: row.order ? `Claims order ${row.order.order_id}` : "No matching attempt.",
                correlationId: row.correlation_id,
                command: `curl -X POST -H "X-Cartisan-Ops-Token: $CARTISAN_OPS_TOKEN" $API/admin/recovery/events/${row.inbox_id}/reprocess`,
              }))}
            />

            <RecoverySection
              title="Orders holding stock with nothing in flight"
              blurb="No live payment attempt and not yet paid. Either the customer retries, or the order is cancelled and the units go back."
              empty="No stuck orders."
              rows={recovery.stuck_orders.map((row) => ({
                key: row.order_id,
                heading: `${row.order_id} · ${row.status} · ${formatMinor(row.total_minor)}`,
                body: (row.recovery_actions ?? []).join(", "),
                correlationId: row.correlation_id,
                origin: row.origin,
                command: (row.recovery_actions ?? []).includes("cancel_order")
                  ? `curl -X POST -H "X-Cartisan-Ops-Token: $CARTISAN_OPS_TOKEN" -H "Content-Type: application/json" -d '{"reason":"abandoned"}' $API/admin/recovery/orders/${row.order_id}/cancel`
                  : "Awaiting a verified provider event; no action to take.",
              }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function RecoverySection({
  title,
  blurb,
  empty,
  rows,
}: {
  title: string;
  blurb: string;
  empty: string;
  rows: {
    key: string;
    heading: string;
    body: string;
    correlationId: string | null;
    origin?: import("@/lib/types").DataOrigin;
    command: string;
  }[];
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 text-[13px] font-semibold tracking-tight">
        {title} <span className="text-ink-faint font-normal">({rows.length})</span>
      </h2>
      <p className="m-0 text-[12px] text-ink-faint max-w-[70ch] leading-relaxed">{blurb}</p>
      {rows.length === 0 ? (
        <div className="text-[12.5px] text-ink-faint py-3">{empty}</div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div
              key={row.key}
              className="bg-white border border-border-soft rounded-lg px-4 py-3 flex flex-col gap-1.5"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[12px] font-medium">{row.heading}</span>
                {row.origin && <OriginBadge origin={row.origin} />}
                {row.correlationId && (
                  <span className="font-mono text-[10.5px] text-ink-faint ml-auto">
                    {row.correlationId}
                  </span>
                )}
              </div>
              {row.body && (
                <p className="m-0 text-[12.5px] text-[#5d5d58] leading-relaxed">{row.body}</p>
              )}
              <code className="text-[11px] font-mono text-ink-faint bg-surface-muted border border-border rounded px-2 py-1.5 overflow-x-auto whitespace-pre">
                {row.command}
              </code>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
