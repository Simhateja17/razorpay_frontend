// Cartisan's 1,536 SKUs are procedurally generated (brand x item x edition), so there is
// no real product photography to link to. Each of the 64 underlying item types gets a
// deterministic stock photo keyword — backend/scripts/seed_catalog.py sets image_label to
// `item.upper()[:24]`, which this map is keyed on.
const ITEM_IMAGE_KEYWORDS: Record<string, string> = {
  "WIRELESS EARBUDS": "earbuds",
  "FAST CHARGER": "usb-charger",
  "POWER BANK": "powerbank",
  "SMART WATCH": "smartwatch",
  "BLUETOOTH SPEAKER": "bluetooth-speaker",
  "USB-C CABLE": "usb-cable",
  "MECHANICAL KEYBOARD": "mechanical-keyboard",
  "WIRELESS MOUSE": "computer-mouse",

  "COFFEE MAKER": "coffee-maker",
  "CAST-IRON PAN": "cast-iron-pan",
  "STORAGE SET": "food-containers",
  "MIXER GRINDER": "blender",
  "ELECTRIC KETTLE": "electric-kettle",
  "TABLE LAMP": "table-lamp",
  "BEDSHEET SET": "bedsheet",
  "WATER BOTTLE": "water-bottle",

  "RUNNING SHOES": "running-shoes",
  "COTTON T-SHIRT": "tshirt",
  "DENIM JACKET": "denim-jacket",
  "CASUAL SHIRT": "mens-shirt",
  "TRAVEL BACKPACK": "backpack",
  SUNGLASSES: "sunglasses",
  "ANALOG WATCH": "wristwatch",
  "CUSHION SOCKS": "socks",

  "DOT-GRID JOURNAL": "notebook",
  "READING LIGHT": "book-light",
  "PENCIL SET": "pencils",
  "GEL PEN SET": "pens",
  "DESK ORGANISER": "desk-organizer",
  "SKETCH BOOK": "sketchbook",
  "EXAM PLANNER": "planner",
  "CANVAS POUCH": "pouch",

  "FACE WASH": "face-wash",
  MOISTURISER: "moisturizer",
  "SUNSCREEN SPF 50": "sunscreen",
  SHAMPOO: "shampoo",
  "BODY LOTION": "lotion",
  "HAIR DRYER": "hair-dryer",
  TRIMMER: "trimmer",
  "BATH TOWEL": "towel",

  "YOGA MAT": "yoga-mat",
  "RESISTANCE BANDS": "resistance-bands",
  "DUMBBELL SET": "dumbbells",
  "CRICKET BAT": "cricket-bat",
  "BADMINTON RACQUET": "badminton-racket",
  FOOTBALL: "soccer-ball",
  "GYM BAG": "gym-bag",
  "SKIPPING ROPE": "jump-rope",

  "BASMATI RICE 5KG": "rice",
  "COLD-PRESSED OIL 1L": "cooking-oil",
  "MIXED NUTS 500G": "mixed-nuts",
  "GREEN TEA 100 BAGS": "green-tea",
  "FILTER COFFEE 500G": "coffee-beans",
  "PEANUT BUTTER 1KG": "peanut-butter",
  "SPICE BOX": "spices",
  "DARK CHOCOLATE": "chocolate",

  "BUILDING BLOCKS": "building-blocks",
  "STRATEGY BOARD GAME": "board-game",
  "REMOTE CONTROL CAR": "rc-car",
  "ART KIT": "art-supplies",
  "JIGSAW PUZZLE": "jigsaw-puzzle",
  "SCIENCE KIT": "science-kit",
  "PLUSH TOY": "teddy-bear",
  "CHESS SET": "chess",
};

// Real product photography, dropped in by hand for a handful of lines. The line
// name is always present verbatim in `title` (backend generator.py: `title =
// f"{brand} {edition} {line.name}"`), so a substring match is exact and needs no
// fuzzy matching. Checked before any remote stock-photo fallback so these load
// instantly from the same origin instead of round-tripping to loremflickr.
const LOCAL_ITEM_IMAGES: [string, string][] = [
  ["Wireless Earbuds", "/products/earbuds.jpeg"],
  ["Sport Earbuds", "/products/earbuds.jpeg"],
  ["Fast Charger", "/products/fast_charger.jpeg"],
  ["USB-C Cable", "/products/usb_c_cable.webp"],
  ["USB-C Dock", "/products/usb_c_dock.jpeg"],
  ["Air Purifier", "/products/air_purifier.webp"],
  ["Phone Case", "/products/phone_case.jpeg"],
  ["Earbud Case", "/products/earbud_case.jpeg"],
  ["Headphone Case", "/products/headphone_case.webp"],
];

/** A locally-hosted photo for this title, if we have one photographed. */
export function localProductImage(title: string): string | null {
  const haystack = title.toUpperCase();
  return LOCAL_ITEM_IMAGES.find(([name]) => haystack.includes(name.toUpperCase()))?.[1] ?? null;
}

const CATEGORY_FALLBACK_KEYWORDS: Record<string, string> = {
  Electronics: "electronics",
  "Home & Kitchen": "kitchenware",
  Fashion: "apparel",
  "Books & Stationery": "stationery",
  "Beauty & Personal Care": "cosmetics",
  "Sports & Fitness": "sports-equipment",
  "Grocery & Gourmet": "groceries",
  "Toys & Games": "toys",
};

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Deterministic stock-photo URL for a product: same item type (image_label) always
 * resolves to the same photo, shared across its brand/edition variants (24 SKUs each).
 */
export function getProductImageUrl(product: { image_label: string; category: string }, size = 400): string {
  const local = localProductImage(product.image_label);
  if (local) return local;
  const keyword =
    ITEM_IMAGE_KEYWORDS[product.image_label] ?? CATEGORY_FALLBACK_KEYWORDS[product.category] ?? "product";
  const lock = hashSeed(product.image_label || product.category);
  return `https://loremflickr.com/${size}/${size}/${keyword}?lock=${lock}`;
}

/**
 * The same idea for the normalized catalogue, which has no `image_label`: match the
 * item type by name against the keyword table, and fall back to the category. The
 * lock is derived from the matched keyword, so every brand and edition of one item
 * type keeps showing the same photo.
 */
export function getVariantImageUrl(
  item: { title: string; category?: string | null },
  size = 400
): string {
  const local = localProductImage(item.title);
  if (local) return local;
  const haystack = item.title.toUpperCase();
  const matched = Object.keys(ITEM_IMAGE_KEYWORDS).find((label) => haystack.includes(label));
  const keyword =
    (matched && ITEM_IMAGE_KEYWORDS[matched]) ??
    (item.category ? CATEGORY_FALLBACK_KEYWORDS[item.category] : undefined) ??
    "product";
  return `https://loremflickr.com/${size}/${size}/${keyword}?lock=${hashSeed(keyword)}`;
}

// Every URL this tab has already asked the browser to fetch. Warming the same photo
// twice is free but pointless, and a turn can name one product in several frames.
const warmed = new Set<string>();

/** A product record in either shape the stream carries: the enriched partial's
 *  `Product` (product_id) or the finished card's `PresentedCard` (variant_id). A
 *  bare `title` is not enough — the payload's own heading is a title too. */
function isProductLike(value: unknown): value is { title: string } {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.title === "string" &&
    (typeof record.product_id === "string" || typeof record.variant_id === "string")
  );
}

/**
 * Start fetching the photos for every product named anywhere in an agent payload.
 *
 * The point is the `ui_partial` frames: the agent streams its picks while it is still
 * writing the presentation, so by the time the finished `ui` component mounts the
 * browser already holds the image and the card renders complete instead of filling in
 * afterwards. Nothing is rendered here — a half-built card is still not shown.
 */
export function preloadProductImages(payload: unknown): void {
  if (typeof window === "undefined") return;
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node !== "object" || node === null) return;
    if (isProductLike(node)) {
      const url = getVariantImageUrl({
        title: node.title,
        category: (node as { category?: string | null }).category,
      });
      if (!warmed.has(url)) {
        warmed.add(url);
        const image = new window.Image();
        image.decoding = "async";
        image.src = url;
      }
    }
    Object.values(node as Record<string, unknown>).forEach(visit);
  };
  visit(payload);
}
