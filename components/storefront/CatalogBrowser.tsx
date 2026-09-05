"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ApiProduct, ProductDetails } from "@/lib/types";
import { formatMinor } from "@/lib/format";
import { useAppState } from "@/lib/store/AppState";
import { localProductImage } from "@/lib/productImage";

const ICONS: Record<string, string> = { "Personal Audio": "♫", "Home Audio": "♫", "Power & Cables": "ϟ", Computing: "⌨", Wearables: "◷", "Smart Home": "⌂" };

export default function CatalogBrowser({ onAsk }: { onAsk: (text: string) => void }) {
  const { browsingVariantId, setBrowsingVariantId, addToCart, turnActive } = useAppState();
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("default");
  const [details, setDetails] = useState<ProductDetails | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    api.catalog().then(data => { if (active) { setProducts(data); setError(null); } })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  useEffect(() => {
    if (!browsingVariantId) return;
    let active = true;
    api.productDetails(browsingVariantId).then(data => { if (active) { setDetails(data); setDetailError(null); } })
      .catch(e => { if (active) setDetailError(e.message); });
    return () => { active = false; };
  }, [browsingVariantId]);
  const selected = products.find(p => p.variants.some(v => v.variant_id === browsingVariantId));
  const variant = selected?.variants.find(v => v.variant_id === browsingVariantId);
  const currentDetails = details?.variant_id === browsingVariantId ? details : null;
  const categories = [...new Set(products.map(p => p.category).filter((c): c is string => !!c))];
  const visible = products.filter(p => (!category || p.category === category) && `${p.title} ${p.brand} ${p.description}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => sort === "low" ? a.from_price_minor - b.from_price_minor : sort === "high" ? b.from_price_minor - a.from_price_minor : 0);
  const select = (id: string | null) => { setDetailError(null); setBrowsingVariantId(id); };
  return <section className="max-w-6xl mx-auto p-4 sm:p-6" aria-label="Browse products">
    {selected && variant ? <>
      <button className="text-sm text-accent mb-5" onClick={() => select(null)}>← Back to products</button>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl bg-surface-muted min-h-48 grid place-items-center border border-border-soft overflow-hidden">{localProductImage(selected.title) ? <img src={localProductImage(selected.title)!} alt={selected.title} className="w-full h-full object-cover" /> : <div className="text-center p-8"><span aria-hidden="true" className="text-7xl text-accent">{ICONS[selected.category ?? ""] ?? "◇"}</span><p className="text-sm mt-4 text-ink-muted">{selected.category}</p><p className="text-xs text-ink-faint">Product image unavailable</p></div>}</div>
        <div><p className="text-xs uppercase tracking-widest text-ink-muted">{selected.brand}</p><h1 className="text-2xl font-semibold mt-2">{selected.title}</h1><p className="text-2xl font-semibold my-3">{formatMinor(variant.price_minor)}</p><p className="text-sm text-ink-muted leading-relaxed">{selected.description}</p>
          <label className="block text-sm mt-4">Choose an option<select className="block w-full mt-2 border border-border rounded-lg p-2 bg-white" value={variant.variant_id} onChange={e => select(e.target.value)}>{selected.variants.map(v => <option key={v.variant_id} value={v.variant_id}>{v.title} — {formatMinor(v.price_minor)}{v.in_stock ? "" : " (out of stock)"}</option>)}</select></label>
          <p className="text-sm mt-3 text-accent">{variant.in_stock ? "In stock" : "Out of stock"}</p>
          <button disabled={!variant.in_stock || adding} className="mt-3 bg-ink text-white rounded-lg px-5 py-3 disabled:opacity-50" onClick={async () => { setAdding(true); try { await addToCart(variant.variant_id, variant.title); } finally { setAdding(false); } }}>{adding ? "Adding…" : "Add to cart"}</button>
        </div>
      </div>
      <div className="my-5 rounded-xl border border-accent/30 bg-white p-4"><h2 className="font-semibold">A little help deciding?</h2><p className="text-sm text-ink-muted mt-1">Your shopping assistant knows which option you’re viewing.</p><div className="flex flex-wrap gap-2 mt-3">{["Is there a similar product for less?", "Is there a better product than this?", "Explain this product’s specifications"].map(text => <button key={text} disabled={turnActive} onClick={() => onAsk(text)} className="text-sm border border-border rounded-full px-3 py-2 hover:border-accent disabled:opacity-50">{text}</button>)}</div></div>
      <h2 className="font-semibold mb-3">Product details</h2>
      {detailError ? <p role="alert" className="text-danger">{detailError}</p> : !currentDetails ? <p role="status">Loading specifications…</p> : <><dl className="grid sm:grid-cols-2 gap-x-8">{Object.entries(currentDetails.specs).map(([key, value]) => <div key={key} className="flex justify-between gap-4 border-b border-border-soft py-2 text-sm"><dt className="capitalize text-ink-muted">{key.replaceAll("_", " ")}</dt><dd>{value}</dd></div>)}</dl>{currentDetails.requirements.map(r => <p key={r} className="text-sm mt-2 text-ink-muted">{r}</p>)}</>}
    </> : <>
      <p className="text-xs uppercase tracking-widest text-accent">Cartisan / The connected shop</p><h1 className="text-3xl font-semibold tracking-tight mt-2">Find your next everyday essential.</h1><p className="text-sm text-ink-muted mt-2 mb-5">Browse the collection. Ask your assistant to compare, find a better price, or help you choose.</p>
      <div className="flex flex-wrap gap-2 mb-4"><input aria-label="Search products" placeholder="Search products or brands" value={query} onChange={e => setQuery(e.target.value)} className="min-w-0 flex-1 basis-48 border border-border rounded-lg px-3 py-2 bg-white" /><select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)} className="max-w-full border border-border rounded-lg px-3 py-2 bg-white"><option value="">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select><select aria-label="Sort products" value={sort} onChange={e => setSort(e.target.value)} className="border border-border rounded-lg px-3 py-2 bg-white"><option value="default">Featured order</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></div>
      {loading ? <p role="status">Loading the collection…</p> : error ? <div role="alert"><p>{error}</p><button className="text-accent mt-2" onClick={() => { setLoading(true); setReload(r => r + 1); }}>Try again</button></div> : <>
        <p className="text-xs text-ink-muted mb-3">{visible.length} products · Demo catalog</p>{!visible.length && <p className="py-8 text-ink-muted">No products match. Try another search or category.</p>}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">{visible.map((product, index) => <button key={product.product_id} className="text-left rounded-xl border border-border-soft bg-white overflow-hidden hover:border-accent transition-colors" onClick={() => select((product.variants.find(v => v.in_stock && v.price_minor === product.from_price_minor) ?? product.variants[0]).variant_id)}><div className="h-28 sm:h-36 bg-surface-muted grid place-items-center text-5xl text-accent overflow-hidden">{localProductImage(product.title) ? <img src={localProductImage(product.title)!} alt={product.title} className="w-full h-full object-cover" loading={index < 10 ? "eager" : "lazy"} fetchPriority={index < 10 ? "high" : "auto"} /> : <span aria-hidden="true">{ICONS[product.category ?? ""] ?? "◇"}</span>}</div><div className="p-3"><p className="text-[11px] text-ink-muted">{product.brand} · {product.category}</p><h2 className="font-medium text-sm mt-1">{product.title}</h2><p className="font-semibold mt-2">From {formatMinor(product.from_price_minor)}</p><p className="text-xs mt-1 text-ink-muted">{product.in_stock ? `${product.variants.length} options` : "Out of stock"}</p></div></button>)}</div>
      </>}
    </>}
  </section>;
}
