import { BusinessSnapshot } from "@/lib/types";
import { formatINR } from "@/lib/format";

export default function KpiStrip({ snapshot }: { snapshot: BusinessSnapshot | null }) {
  const facts = snapshot
    ? [
        { label: `Sales (${snapshot.period.replace(/_/g, " ")})`, value: formatINR(snapshot.sales) },
        { label: "Orders", value: String(snapshot.orders) },
        { label: "AOV", value: formatINR(Math.round(snapshot.average_order_value)) },
        { label: "Traffic", value: snapshot.traffic != null ? String(snapshot.traffic) : null },
        { label: "Conversion", value: snapshot.conversion_rate != null ? `${snapshot.conversion_rate}%` : null },
      ]
    : [
        { label: "Sales", value: null },
        { label: "Orders", value: null },
        { label: "AOV", value: null },
        { label: "Traffic", value: null },
        { label: "Conversion", value: null },
      ];
  const note = snapshot?.limitations?.[0]?.note;

  return (
    <div className="flex-none grid grid-cols-2 sm:grid-cols-5 gap-px bg-border-soft border-b border-border-soft">
      {facts.map((f) => (
        <div key={f.label} className="bg-white px-4 py-3 flex flex-col gap-1">
          <span className="text-[11px] text-ink-faint">{f.label}</span>
          {f.value ? (
            <span className="font-mono text-[15px] font-medium">{f.value}</span>
          ) : (
            <span className="font-mono text-[13px] text-ink-faint border border-dashed border-border rounded px-1.5 py-0.5 w-fit">
              {snapshot ? "unavailable" : "…"}
            </span>
          )}
          {!f.value && note && <span className="text-[10.5px] text-ink-faint">{note}</span>}
        </div>
      ))}
    </div>
  );
}
