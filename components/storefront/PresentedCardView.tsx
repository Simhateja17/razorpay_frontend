"use client";

import { useState } from "react";
import Image from "next/image";
import { PresentedCard } from "@/lib/types";
import { useAppState } from "@/lib/store/AppState";
import { getVariantImageUrl } from "@/lib/productImage";

/**
 * One card the agent presented.
 *
 * Everything shown here — the title, the price, the stock — came from the server's
 * enrichment of the presentation, not from the model's own text, which is what makes
 * the card trustworthy (ADR 0020). A cross-sell is labelled as optional and is never
 * added on the customer's behalf (ADR 0007).
 */
export default function PresentedCardView({ card, priority = false }: { card: PresentedCard; priority?: boolean }) {
  const { addToCart } = useAppState();
  const [imageFailed, setImageFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const imageUrl = getVariantImageUrl({ title: card.title });
  const isLocal = imageUrl.startsWith("/");

  const handleAdd = async () => {
    if (adding || !card.in_stock) return;
    setAdding(true);
    await addToCart(card.variant_id, card.title);
    setAdding(false);
  };

  const options = Object.entries(card.options ?? {});
  const specs = Object.entries(card.specifications ?? {});

  return (
    <div
      className={`flex flex-col gap-2 bg-white border rounded-xl p-3 ${
        card.is_cross_sell ? "border-accent/40" : "border-border-soft"
      }`}
    >
      <div
        className="relative h-[104px] rounded-md bg-surface-muted border border-border-soft overflow-hidden flex items-center justify-center text-ink-faint font-mono text-[10px] tracking-wide"
        role="img"
        aria-label={card.title}
      >
        {imageFailed ? (
          card.brand.toUpperCase()
        ) : (
          <Image
            src={imageUrl}
            alt={card.title}
            fill
            sizes="(max-width: 768px) 100vw, 196px"
            unoptimized={!isLocal}
            className="object-cover"
            loading={priority ? "eager" : "lazy"}
            priority={priority}
            fetchPriority={priority ? "high" : "auto"}
            onError={() => setImageFailed(true)}
          />
        )}
      </div>

      {card.is_cross_sell && (
        <span className="self-start font-mono text-[9.5px] tracking-wide text-accent border border-accent/40 rounded px-1.5 py-0.5">
          OPTIONAL PAIRING
        </span>
      )}

      <div className="flex flex-col gap-0.5">
        <span className="text-[13.5px] font-medium leading-tight">{card.title}</span>
        <span className="text-[11.5px] text-ink-faint">{card.brand}</span>
      </div>

      {options.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {options.map(([key, value]) => (
            <span
              key={key}
              className="text-[11px] px-1.5 py-0.5 rounded border border-border text-ink-muted"
            >
              {value}
            </span>
          ))}
        </div>
      )}

      <span className="font-mono text-[14.5px] font-medium">{card.price}</span>

      {specs.length > 0 && (
        <ul className="m-0 p-0 list-none flex flex-col gap-0.5">
          {specs.map(([key, value]) => (
            <li key={key} className="flex justify-between gap-2 text-[11px] text-ink-muted">
              <span className="capitalize">{key.replace(/_/g, " ")}</span>
              <span className="text-ink">{value}</span>
            </li>
          ))}
        </ul>
      )}

      {card.reason && (
        <span className="text-[11.5px] text-[#5d5d58] leading-relaxed">{card.reason}</span>
      )}
      {card.fit_checks?.map((check) => (
        <span key={check} className="text-[11px] text-success-ink leading-relaxed flex gap-1.5">
          <span aria-hidden="true">✓</span>{check}
        </span>
      ))}

      {!card.in_stock ? (
        <span className="text-[11.5px] text-danger">Out of stock</span>
      ) : (
        <button
          onClick={handleAdd}
          disabled={adding}
          aria-busy={adding}
          className="mt-1 w-full bg-ink text-bg text-[13px] font-medium rounded-lg py-2 hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-wait"
        >
          {adding ? "Adding…" : "Add to cart"}
        </button>
      )}
    </div>
  );
}
