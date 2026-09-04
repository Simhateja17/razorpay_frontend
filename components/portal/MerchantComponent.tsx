"use client";

import { useState } from "react";
import { RenderedComponent, Claim, ClaimKind, MetricsPayload } from "@/lib/types";
import { formatMinor } from "@/lib/format";
import { useAppState } from "@/lib/store/AppState";

/**
 * Renders one component the merchant agent emitted as a `ui` event.
 *
 * The portal's counterpart to the storefront's `AgentComponent`: the same event
 * stream, a different set of components. Two things are deliberate here and are not
 * styling. Every figure is labelled with the kind of claim it is, and the formula
 * behind it is one hover away — a merchant surface that shows a number with no
 * derivation is asking to be trusted rather than checked (ADR 0017). And a change
 * preview carries no Approve button: previewing and deciding are different acts with
 * different authorities, and the decision lives in the approval queue (ADR 0016).
 */
const CLAIM_TONE: Record<ClaimKind, string> = {
  observed: "text-ink-faint border-border",
  estimated: "text-accent border-accent/40",
  // Never produced: the backend gate refuses a causal claim. If one ever renders,
  // it should look wrong.
  causal: "text-danger border-danger-border",
};

const CLAIM_LABEL: Record<ClaimKind, string> = {
  observed: "MEASURED",
  estimated: "ESTIMATED",
  causal: "CAUSAL — UNSUPPORTED",
};

function ClaimTag({ kind }: { kind: ClaimKind }) {
  return (
    <span
      className={`flex-none font-mono text-[9.5px] tracking-wide border rounded px-1.5 py-0.5 ${CLAIM_TONE[kind]}`}
      title={
        kind === "estimated"
          ? "A deterministic formula over measured inputs, with its limitations stated."
          : "Measured from the commerce event log."
      }
    >
      {CLAIM_LABEL[kind]}
    </span>
  );
}

export default function MerchantComponent({ component }: { component: RenderedComponent }) {
  switch (component.kind) {
    case "digest": {
      const { title, items, evidence } = component.payload;
      return (
        <section className="ml-9 flex flex-col gap-2">
          <h2 className="m-0 text-[13px] font-medium text-ink-muted">{title}</h2>
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <div
                key={item.heading}
                className="bg-white border border-border rounded-lg px-3 py-2.5 flex flex-col gap-1.5"
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[13px] font-medium leading-snug">{item.heading}</span>
                  <ClaimTag kind={item.claim_kind} />
                </div>
                <p className="m-0 text-[12.5px] text-[#3d3d39] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
          {/* What this turn actually read. It is here so the lines above can be checked
              against the reads rather than taken on trust. */}
          {evidence.metrics_read.length + evidence.claims_read.length > 0 && (
            <span className="font-mono text-[9.5px] text-ink-faint tracking-wide leading-relaxed">
              FROM {[...evidence.metrics_read, ...evidence.claims_read].slice(0, 6).join(" · ")}
            </span>
          )}
        </section>
      );
    }

    case "metrics": {
      const p = component.payload;
      const peak = Math.max(1, ...p.points.map((point) => Math.abs(point.value)));
      const money = p.unit === "INR paise";
      return <MetricsChart p={p} peak={peak} money={money} />;
    }

    case "change_preview": {
      const p = component.payload;
      return (
        <section className="ml-9">
          <div className="bg-white border border-accent/40 rounded-xl p-4 flex flex-col gap-2.5">
            <div className="flex justify-between items-baseline gap-3">
              <span className="text-[13.5px] font-medium">
                {p.kind.split("_").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ")}
                {p.target_id ? ` · ${p.target_id}` : ""}
              </span>
              <span className="flex-none font-mono text-[9.5px] tracking-wide text-ink-faint">
                {p.status.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[13px] flex-wrap">
              <span className="text-ink-faint line-through">{JSON.stringify(p.before)}</span>
              <span className="text-ink-faint">→</span>
              <span className="font-medium text-ink">{JSON.stringify(p.after)}</span>
            </div>
            <p className="m-0 text-[12px] text-ink-muted leading-relaxed">{p.rationale}</p>
            {p.note && (
              <p className="m-0 text-[12px] text-[#3d3d39] leading-relaxed">{p.note}</p>
            )}
            {/* No button. Deciding is not something the conversation can do. */}
            <span className="text-[11px] text-ink-faint leading-relaxed border-t border-border-soft pt-2">
              Queued and not applied. Approve or reject it in {p.approval_surface}; Cartisan
              re-checks the bounds against current figures before writing anything.
            </span>
          </div>
        </section>
      );
    }

    case "suggestions":
      return <OperatorChips suggestions={component.payload.suggestions} />;
  }
}

function MetricsChart({
  p,
  peak,
  money,
}: {
  p: MetricsPayload;
  peak: number;
  money: boolean;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const hovered = hoverIndex !== null ? p.points[hoverIndex] : null;

  return (
    <section className="ml-9 flex flex-col gap-2">
      <div className="bg-white border border-border rounded-xl p-4 flex flex-col gap-3">
        <div className="flex justify-between items-baseline gap-3">
          <span className="text-[13.5px] font-medium">{p.title}</span>
          <ClaimTag kind={p.claim_kind} />
        </div>
        {p.total !== null && (
          <span className="font-mono text-[22px] font-medium leading-none">
            {p.total_label ?? (p.unit === "ratio" ? `${(p.total * 100).toFixed(1)}%` : p.total)}
          </span>
        )}

        {p.points.length > 0 && (
          <div className="relative">
            {hovered && (
              <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full z-10 whitespace-nowrap bg-ink text-white text-[11px] rounded-md px-2 py-1 shadow-md">
                <div className="font-medium">
                  {money ? formatMinor(hovered.value) : hovered.value}
                  {typeof hovered.orders === "number" ? ` · ${hovered.orders} orders` : ""}
                </div>
                <div className="text-white/60 text-[10px]">{hovered.date}</div>
              </div>
            )}
            <div
              className="flex items-end gap-1 h-[64px]"
              role="img"
              aria-label={p.title}
              onMouseLeave={() => setHoverIndex(null)}
            >
              {p.points.map((point, i) => (
                <div
                  key={point.date}
                  onMouseEnter={() => setHoverIndex(i)}
                  onFocus={() => setHoverIndex(i)}
                  onBlur={() => setHoverIndex(null)}
                  tabIndex={0}
                  className={`flex-1 rounded-t-sm min-w-[3px] cursor-pointer transition-colors ${
                    hoverIndex === i ? "bg-accent/60" : "bg-accent/25 hover:bg-accent/45"
                  }`}
                  style={{ height: `${Math.max(3, (Math.abs(point.value) / peak) * 100)}%` }}
                />
              ))}
            </div>
          </div>
        )}

        <p className="m-0 text-[12.5px] text-[#3d3d39] leading-relaxed">{p.reading}</p>

        <div className="flex flex-col gap-1 pt-1 border-t border-border-soft">
          <span className="font-mono text-[9.5px] text-ink-faint tracking-wide">
            {p.window_days}D · {p.origins.join(", ").toUpperCase()}
            {p.group_by ? ` · BY ${p.group_by.toUpperCase()}` : ""}
          </span>
          <span className="text-[10.5px] text-ink-faint leading-relaxed">{p.basis}</span>
          {p.limitations.map((note) => (
            <span key={note} className="text-[10.5px] text-ink-faint leading-relaxed">
              {note}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function OperatorChips({ suggestions }: { suggestions: string[] }) {
  const { sendMerchantMessage, portalTurnActive } = useAppState();
  return (
    <div className="ml-9 flex flex-wrap gap-2">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          onClick={() => sendMerchantMessage(suggestion)}
          disabled={portalTurnActive}
          className="bg-white border border-border rounded-full px-3 py-1.5 text-[12.5px] text-ink hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
