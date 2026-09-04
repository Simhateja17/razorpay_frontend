import { BusinessSnapshot, Claim } from "@/lib/types";

/**
 * The headline position, straight off the snapshot's claims.
 *
 * Every tile shows a figure the event log measured, and hovering it shows the formula
 * that produced it — the `basis` and `inputs` the claim carries. That is not decoration:
 * a merchant surface that shows numbers without their derivation is asking to be
 * trusted, and this one is meant to be checked (ADR 0017).
 */
const TILES: { key: string; label: string }[] = [
  { key: "net_revenue_minor", label: "Net revenue" },
  { key: "paid_orders", label: "Paid orders" },
  { key: "average_order_value_minor", label: "AOV" },
  { key: "checkout_conversion_rate", label: "Checkout conversion" },
  { key: "agent_assisted_revenue_minor", label: "Agent-assisted" },
];

function display(claim: Claim | undefined): string | null {
  if (!claim || claim.value === null) return null;
  if (claim.value_label) return claim.value_label;
  if (claim.unit === "ratio") return `${(claim.value * 100).toFixed(1)}%`;
  return String(claim.value);
}

function movementLabel(movement: Claim | undefined): string | null {
  if (!movement || movement.value === null) return null;
  const pct = movement.value * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs previous`;
}

export default function KpiStrip({ snapshot }: { snapshot: BusinessSnapshot | null }) {
  const claims = new Map((snapshot?.claims ?? []).map((c) => [c.key, c]));
  const movements = new Map((snapshot?.movements ?? []).map((m) => [m.key, m]));

  return (
    <div className="flex-none">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-border-soft border-b border-border-soft">
        {TILES.map(({ key, label }) => {
          const claim = claims.get(key);
          const value = display(claim);
          const movement = movementLabel(movements.get(`${key}:movement`));
          return (
            <div
              key={key}
              className="bg-white px-4 py-3 flex flex-col gap-1"
              title={claim ? `${claim.basis} — ${JSON.stringify(claim.inputs)}` : undefined}
            >
              <span className="text-[11px] text-ink-faint">{label}</span>
              {value ? (
                <span className="font-mono text-[15px] font-medium">{value}</span>
              ) : (
                <span className="font-mono text-[13px] text-ink-faint border border-dashed border-border rounded px-1.5 py-0.5 w-fit">
                  {snapshot ? "not connected" : "…"}
                </span>
              )}
              {movement && <span className="text-[10.5px] text-ink-faint">{movement}</span>}
            </div>
          );
        })}
      </div>
      {snapshot && (
        <div className="bg-surface-muted border-b border-border-soft px-4 py-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
          <span className="font-mono text-[10px] text-ink-faint tracking-wide">
            {snapshot.window_days}D · {snapshot.origins.join(", ").toUpperCase()}
          </span>
          {/* What these figures cannot support, said once rather than left as a gap the
              reader fills in with an assumption. */}
          {snapshot.limitations.map((note) => (
            <span key={note} className="text-[10.5px] text-ink-faint leading-snug">
              {note}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
