"use client";

import { RenderedComponent } from "@/lib/types";
import { formatMinor } from "@/lib/format";
import { useAppState } from "@/lib/store/AppState";
import PresentedCardView from "./PresentedCardView";

/**
 * Renders one component the agent emitted as a `ui` event.
 *
 * The switch is exhaustive over the components this client claims to know; anything
 * else was already filtered out upstream, so a new backend component type degrades
 * to "not shown" rather than to a crash.
 */
export default function AgentComponent({ component }: { component: RenderedComponent }) {
  switch (component.kind) {
    case "products": {
      const { title, items } = component.payload;
      return (
        <section className="ml-9 flex flex-col gap-2">
          {title && <h2 className="m-0 text-[13px] font-medium text-ink-muted">{title}</h2>}
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(196px, 1fr))" }}
          >
            {items.map((card) => (
              <PresentedCardView key={card.item_ref} card={card} />
            ))}
          </div>
        </section>
      );
    }

    case "comparison": {
      const { title, entries, recommended_variant_id } = component.payload;
      return (
        <section className="ml-9 flex flex-col gap-2">
          {title && <h2 className="m-0 text-[13px] font-medium text-ink-muted">{title}</h2>}
          <div className="overflow-x-auto">
            <div className="flex gap-3 min-w-min">
              {entries.map((entry) => (
                <div key={entry.item_ref} className="w-[232px] flex-none flex flex-col gap-2">
                  {entry.variant_id === recommended_variant_id && (
                    <span className="self-start font-mono text-[9.5px] tracking-wide text-accent border border-accent/40 rounded px-1.5 py-0.5">
                      RECOMMENDED
                    </span>
                  )}
                  <PresentedCardView card={entry} />
                  <dl className="m-0 flex flex-col gap-1.5 text-[11.5px] leading-relaxed">
                    {entry.pros.length > 0 && (
                      <div>
                        <dt className="font-mono text-[9.5px] text-ink-faint tracking-wide">FOR</dt>
                        <dd className="m-0 text-[#3d3d39]">{entry.pros.join(" · ")}</dd>
                      </div>
                    )}
                    {entry.cons.length > 0 && (
                      <div>
                        <dt className="font-mono text-[9.5px] text-ink-faint tracking-wide">AGAINST</dt>
                        <dd className="m-0 text-[#5d5d58]">{entry.cons.join(" · ")}</dd>
                      </div>
                    )}
                    {entry.best_for && (
                      <div>
                        <dt className="font-mono text-[9.5px] text-ink-faint tracking-wide">BEST FOR</dt>
                        <dd className="m-0 text-[#3d3d39]">{entry.best_for}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case "cart": {
      const { title, note, lines, subtotal } = component.payload;
      return (
        <section className="ml-9 max-w-[430px] bg-white border border-border-soft rounded-xl p-4 flex flex-col gap-2.5">
          <span className="font-mono text-[10px] text-ink-faint tracking-wide">
            {title?.toUpperCase() ?? "YOUR CART"}
          </span>
          <div className="flex flex-col gap-1.5">
            {lines.map((line) => (
              <div
                key={line.variant_id}
                className="flex justify-between gap-3 text-[13px] text-[#3d3d39]"
              >
                <span>
                  {line.title}
                  {line.quantity > 1 ? ` ×${line.quantity}` : ""}
                </span>
                <span className="font-mono text-ink">{line.amount}</span>
              </div>
            ))}
          </div>
          <div className="h-px bg-border-soft" />
          <div className="flex justify-between items-baseline">
            <span className="text-[13.5px] font-medium">Subtotal</span>
            <span className="font-mono text-[16px] font-medium">{subtotal}</span>
          </div>
          {note && <span className="text-[11.5px] text-ink-faint leading-relaxed">{note}</span>}
        </section>
      );
    }

    case "checkout":
      return <StagePreview payload={component.payload} />;

    case "order_status": {
      const { summary, order_id, status, payment_state, total, lines } = component.payload;
      // `paid` is the server's word, and only the server's: a status short of it is
      // shown as-is rather than softened into something that reads like success.
      const paid = payment_state === "paid";
      return (
        <section
          className={`ml-9 max-w-[430px] rounded-xl p-4 flex flex-col gap-2 border ${
            paid ? "bg-success-bg border-success-border" : "bg-white border-border-soft"
          }`}
        >
          <div className="flex justify-between items-baseline gap-3">
            <span className="text-[14px] font-medium">{summary}</span>
            <span className="font-mono text-[10px] text-ink-faint uppercase tracking-wide">
              {status.replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {lines.map((line) => (
              <div
                key={line.variant_id}
                className="flex justify-between gap-3 text-[12.5px] text-[#5d5d58]"
              >
                <span>
                  {line.title}
                  {line.quantity > 1 ? ` ×${line.quantity}` : ""}
                </span>
                <span className="font-mono">{formatMinor(line.unit_price_minor * line.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[13px] font-medium">Total</span>
            <span className="font-mono text-[15px] font-medium">{total}</span>
          </div>
          <span className="font-mono text-[10.5px] text-ink-faint">order {order_id}</span>
        </section>
      );
    }

    case "guide": {
      const { title, sections, related } = component.payload;
      return (
        <section className="ml-9 max-w-[560px] flex flex-col gap-3">
          <div className="bg-white border border-border-soft rounded-xl p-4 flex flex-col gap-3">
            <h2 className="m-0 text-[14.5px] font-medium">{title}</h2>
            {sections.map((section) => (
              <div key={section.heading} className="flex flex-col gap-1">
                <h3 className="m-0 text-[12.5px] font-medium text-ink-muted">{section.heading}</h3>
                <p className="m-0 text-[13px] leading-relaxed text-[#3d3d39]">{section.body}</p>
              </div>
            ))}
          </div>
          {related.length > 0 && (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(196px, 1fr))" }}
            >
              {related.map((card) => (
                <PresentedCardView key={card.item_ref ?? card.variant_id} card={card} />
              ))}
            </div>
          )}
        </section>
      );
    }

    case "suggestions":
      return <SuggestionChips suggestions={component.payload.suggestions} />;
  }
}

/**
 * The staged preview the agent produced. It is exact, expiring, and holds nothing —
 * confirming it is a separate act by the customer, handled by the host, which is
 * what creates the order and reserves the stock (ADR 0005, ADR 0012).
 */
function StagePreview({
  payload,
}: {
  payload: Extract<RenderedComponent, { kind: "checkout" }>["payload"];
}) {
  const { confirmAndPay, checkoutError, checkout } = useAppState();
  const alreadyConfirmed = checkout?.order.status !== undefined;

  return (
    <section className="ml-9 max-w-[430px] bg-white border border-[#cfd9d5] rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 pt-4 pb-3 flex flex-col gap-2.5">
        <div className="flex justify-between items-baseline">
          <span className="font-mono text-[10px] text-ink-faint tracking-wide">REVIEW CHECKOUT</span>
          <span className="font-mono text-[10px] text-ink-faint">
            {payload.fulfillment_option.toUpperCase()}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {payload.lines.map((line) => (
            <div
              key={line.variant_id}
              className="flex justify-between gap-3 text-[13px] text-[#3d3d39]"
            >
              <span>
                {line.title}
                {line.quantity > 1 ? ` ×${line.quantity}` : ""}
              </span>
              <span className="font-mono text-ink">{line.amount}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1 text-[12px] text-ink-muted">
          <Row label="Subtotal" value={formatMinor(payload.subtotal_minor)} />
          {payload.shipping_minor > 0 && (
            <Row label="Shipping" value={formatMinor(payload.shipping_minor)} />
          )}
          {payload.tax_minor > 0 && <Row label="Tax" value={formatMinor(payload.tax_minor)} />}
          {payload.discount_minor > 0 && (
            <Row label="Discount" value={`−${formatMinor(payload.discount_minor)}`} />
          )}
        </div>
        <div className="h-px bg-border-soft" />
        <div className="flex justify-between items-baseline">
          <span className="text-[13.5px] font-medium">Total</span>
          <span className="font-mono text-[19px] font-medium">{payload.total}</span>
        </div>
        {payload.constraints_note && (
          <span className="text-[11.5px] text-ink-faint leading-relaxed">
            {payload.constraints_note}
          </span>
        )}
      </div>
      <div className="px-4 pb-4 flex flex-col gap-2">
        <button
          onClick={() => confirmAndPay(payload.stage_id)}
          disabled={payload.state !== "staged" || alreadyConfirmed}
          className="w-full bg-accent text-white border-none rounded-lg py-3 text-[14px] font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          Pay {payload.total} via Razorpay
        </button>
        {checkoutError && <span className="text-[12px] text-danger">{checkoutError}</span>}
        <span className="text-[11px] text-ink-faint text-center leading-relaxed">
          Confirming places the order and holds your items. Nothing is charged until you
          pay on Razorpay.
        </span>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function SuggestionChips({ suggestions }: { suggestions: string[] }) {
  const { sendShopperMessage, turnActive } = useAppState();
  return (
    <div className="ml-9 flex flex-wrap gap-2">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          onClick={() => sendShopperMessage(suggestion)}
          disabled={turnActive}
          className="bg-white border border-border rounded-full px-3 py-1.5 text-[12.5px] text-ink hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
