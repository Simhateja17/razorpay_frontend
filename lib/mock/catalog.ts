import { ProductCard } from "@/lib/types";

// Fixture catalog matching BUILD_PLAN.md §5: 4 categories, curated,
// each with an explicit cross-sell pair (crossSellOf points at the
// product id it's a valid upsell for). Mirrors backend/marketplace_backend/catalog.json
// shape once that lands — same ids should be reused there.

export const CATALOG: ProductCard[] = [
  // Electronics
  { id: "P-EL-01", name: "Aster Wireless Earbuds", meta: "Electronics · 28h battery", price: 2499, priceLabel: "₹2,499", rating: "4.4★ (812)", imgLabel: "EARBUDS" },
  { id: "P-EL-02", name: "Nimbus 20W Fast Charger", meta: "Electronics · USB-C, PD 3.0", price: 899, priceLabel: "₹899", rating: "4.6★ (1.2k)", imgLabel: "CHARGER", crossSellOf: "P-EL-03" },
  { id: "P-EL-03", name: "Halcyon Phone Case", meta: "Electronics · Clear, drop-proof", price: 599, priceLabel: "₹599", rating: "4.2★ (430)", imgLabel: "CASE" },
  { id: "P-EL-04", name: "Orbit Power Bank 10000mAh", meta: "Electronics · Slim, 2-port", price: 1299, priceLabel: "₹1,299", rating: "4.3★ (601)", imgLabel: "POWERBANK" },

  // Home & Kitchen
  { id: "P-HK-01", name: "Solace Drip Coffee Maker", meta: "Home & Kitchen · 4-cup", price: 3199, priceLabel: "₹3,199", rating: "4.5★ (295)", imgLabel: "COFFEE" },
  { id: "P-HK-02", name: "Solace Paper Filters (100pk)", meta: "Home & Kitchen · Fits Solace 4-cup", price: 249, priceLabel: "₹249", rating: "4.7★ (188)", imgLabel: "FILTERS", crossSellOf: "P-HK-01" },
  { id: "P-HK-03", name: "Ferro Cast-Iron Pan", meta: "Home & Kitchen · 10 inch, pre-seasoned", price: 1799, priceLabel: "₹1,799", rating: "4.6★ (512)", imgLabel: "PAN" },
  { id: "P-HK-04", name: "Ferro Pan Care Kit", meta: "Home & Kitchen · Oil + scraper", price: 349, priceLabel: "₹349", rating: "4.1★ (76)", imgLabel: "CAREKIT", crossSellOf: "P-HK-03" },

  // Fashion
  {
    id: "P-FA-01",
    name: "Meridian Running Shoes",
    meta: "Fashion · Men's, breathable mesh",
    price: 2999,
    priceLabel: "₹2,999",
    rating: "4.4★ (940)",
    imgLabel: "SHOES",
    variants: [
      { id: "P-FA-01-8", label: "UK 8" },
      { id: "P-FA-01-9", label: "UK 9" },
      { id: "P-FA-01-10", label: "UK 10" },
    ],
  },
  { id: "P-FA-02", name: "Meridian Cushion Socks (3pk)", meta: "Fashion · Runs with any shoe size", price: 449, priceLabel: "₹449", rating: "4.5★ (321)", imgLabel: "SOCKS", crossSellOf: "P-FA-01" },
  { id: "P-FA-03", name: "Aldervale Cotton Tee", meta: "Fashion · Unisex, 220 GSM", price: 799, priceLabel: "₹799", rating: "4.3★ (654)", imgLabel: "TEE" },
  { id: "P-FA-04", name: "Aldervale Denim Jacket", meta: "Fashion · Unisex, mid-wash", price: 2699, priceLabel: "₹2,699", rating: "4.2★ (198)", imgLabel: "JACKET" },

  // Books & Stationery
  { id: "P-BS-01", name: "The Quiet Ledger — Novel", meta: "Books & Stationery · Paperback", price: 399, priceLabel: "₹399", rating: "4.6★ (233)", imgLabel: "BOOK" },
  { id: "P-BS-02", name: "Lumen Clip-On Reading Light", meta: "Books & Stationery · USB rechargeable", price: 549, priceLabel: "₹549", rating: "4.4★ (167)", imgLabel: "LIGHT", crossSellOf: "P-BS-01" },
  { id: "P-BS-03", name: "Fieldnote Dot-Grid Journal", meta: "Books & Stationery · A5, 160 pages", price: 349, priceLabel: "₹349", rating: "4.7★ (410)", imgLabel: "JOURNAL" },
  { id: "P-BS-04", name: "Graphite Pencil Set (12pc)", meta: "Books & Stationery · 2H–6B", price: 299, priceLabel: "₹299", rating: "4.5★ (289)", imgLabel: "PENCILS", crossSellOf: "P-BS-03" },
];

export function findProduct(id: string): ProductCard | undefined {
  return CATALOG.find((p) => p.id === id);
}

export function crossSellFor(id: string): ProductCard | undefined {
  return CATALOG.find((p) => p.crossSellOf === id);
}

const STOPWORDS = new Set([
  "i", "a", "an", "the", "and", "or", "for", "with", "of", "to", "in", "on",
  "at", "is", "are", "my", "me", "need", "want", "show", "some", "something",
  "under", "that", "this", "it", "im", "would", "like",
]);

export function searchCatalog(query: string): ProductCard[] {
  const q = query.toLowerCase();
  const terms = q
    .replace(/[₹,.]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  if (terms.length === 0) return CATALOG.slice(0, 3);
  const scored = CATALOG.map((p) => {
    const hay = `${p.name} ${p.meta}`.toLowerCase();
    const score = terms.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
    return { p, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return (scored.length ? scored.map((x) => x.p) : CATALOG.slice(0, 3)).slice(0, 4);
}
