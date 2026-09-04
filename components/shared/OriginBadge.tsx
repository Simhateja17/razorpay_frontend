import { DataOrigin } from "@/lib/types";

/**
 * The origin label, in one place.
 *
 * ADR 0032 asks that a reader never has to guess which kind of record they are
 * looking at: generated history, something a person did in the app just now, or
 * evidence that came from Razorpay test mode. Until Phase 7 that distinction was
 * visible only in the merchant KPI strip, so an order and an audit row could be
 * read as the same kind of fact when they are not.
 *
 * The three read differently on purpose. `seeded` is deliberately quiet — it is
 * backdrop, and it must never be mistaken for something Cartisan earned.
 */
const STYLES: Record<DataOrigin, { label: string; className: string; title: string }> = {
  seeded: {
    label: "Seeded",
    className: "bg-surface-muted text-ink-faint border-border",
    title: "Generated demo history. Not a purchase anyone made in this app.",
  },
  live_app: {
    label: "Live",
    className: "bg-success-bg text-success-ink border-success-border",
    title: "Created by a person using this application.",
  },
  razorpay_test: {
    label: "Razorpay test",
    className: "bg-upsell-bg text-upsell-ink border-upsell-border",
    title: "Evidence that came from Razorpay test mode, or a named scenario pack.",
  },
};

export default function OriginBadge({
  origin,
  className = "",
}: {
  origin: DataOrigin | null | undefined;
  className?: string;
}) {
  if (!origin || !STYLES[origin]) return null;
  const style = STYLES[origin];
  return (
    <span
      title={style.title}
      className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${style.className} ${className}`}
    >
      {style.label}
    </span>
  );
}
