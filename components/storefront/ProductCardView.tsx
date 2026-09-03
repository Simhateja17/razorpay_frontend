"use client";

import { useState } from "react";
import { ApiProduct } from "@/lib/types";
import { useAppState } from "@/lib/store/AppState";

export default function ProductCardView({ product }: { product: ApiProduct }) {
  const { addToCart } = useAppState();
  const hasVariants = !!product.variants && product.variants.length > 0;
  const [variantId, setVariantId] = useState(hasVariants ? product.variants![0].id : undefined);

  const selected = hasVariants ? product.variants!.find((v) => v.id === variantId) : product;
  const purchasable = hasVariants ? selected : product;
  const outOfStock = purchasable ? !purchasable.in_stock : true;

  const handleAdd = () => {
    if (purchasable) addToCart(purchasable);
  };

  return (
    <div className="flex flex-col gap-2 bg-white border border-border-soft rounded-xl p-3">
      <div
        className="h-[104px] rounded-md bg-surface-muted border border-border-soft flex items-center justify-center text-ink-faint font-mono text-[10px] tracking-wide"
        role="img"
        aria-label={product.name}
      >
        {product.image_label}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[13.5px] font-medium leading-tight">{product.name}</span>
        <span className="text-[11.5px] text-ink-faint">{product.meta}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-[14.5px] font-medium">{product.price_label}</span>
        {product.rating && <span className="text-[11px] text-ink-faint">{product.rating}</span>}
      </div>
      {hasVariants && (
        <div className="flex gap-1.5 flex-wrap">
          {product.variants!.map((v) => (
            <button
              key={v.id}
              onClick={() => setVariantId(v.id)}
              disabled={!v.in_stock}
              className={`text-[11.5px] px-2 py-1 rounded-md border disabled:opacity-40 disabled:cursor-not-allowed ${
                variantId === v.id ? "border-accent text-accent" : "border-border text-ink-muted"
              }`}
            >
              {v.name.split("—").pop()?.trim() ?? v.name}
            </button>
          ))}
        </div>
      )}
      {outOfStock ? (
        <span className="text-[11.5px] text-danger">Out of stock</span>
      ) : (
        <button
          onClick={handleAdd}
          className="mt-1 w-full bg-ink text-bg text-[13px] font-medium rounded-lg py-2 hover:opacity-90 transition-opacity"
        >
          Add to cart
        </button>
      )}
    </div>
  );
}
