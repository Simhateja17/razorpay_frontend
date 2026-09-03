// Types matching the real Cartisan backend (backend/api/main.py,
// backend/marketplace_backend/*, backend/cartisan_agent/*).
//
// Phase 5 moved shopping onto the normalized commerce core, so the ids here are
// VARIANT ids throughout: a variant is the thing that has a price, a stock level
// and an order line, and it is the single id the cart, the staged checkout and the
// order all share. Money is integer minor units (paise) everywhere it is computed;
// the `*_label` strings are the server's own formatting, never re-derived here.

export type AgentKind = "shopping" | "merchant";

// ---------------------------------------------------------------- catalogue

export interface ApiVariant {
  variant_id: string;
  sku: string;
  title: string;
  options: Record<string, string>;
  price_minor: number;
  sellable: number;
  in_stock: boolean;
}

export interface ApiProduct {
  product_id: string;
  title: string;
  brand: string;
  category: string | null;
  description: string;
  origin: DataOrigin;
  from_price_minor: number;
  in_stock: boolean;
  variants: ApiVariant[];
}

// Seeded history, a live app purchase, and provider test-mode evidence stay
// visibly distinct wherever they are shown (ADR 0032).
export type DataOrigin = "seeded" | "live_app" | "razorpay_test";

// --------------------------------------------------------------------- cart

export interface CartLineApi {
  variant_id: string;
  title: string;
  quantity: number;
  unit_price_minor: number;
  amount_minor: number;
}

export interface CartApi {
  // The cart is owned by the authenticated customer, not by a conversation.
  cart_id: string;
  customer_id: string;
  // Bumped by every mutation; pass it back as `expected_version` to make a
  // concurrent change a visible 409 rather than a lost update.
  state_version: number;
  currency: string;
  subtotal_minor: number;
  lines: CartLineApi[];
}

// ----------------------------------------------------------------- checkout

export interface StagedCheckout {
  stage_id: string;
  cart_id: string;
  cart_state_version: number;
  state: "staged" | "confirmed" | "expired" | "superseded";
  currency: string;
  lines: CartLineApi[];
  subtotal_minor: number;
  shipping_minor: number;
  tax_minor: number;
  discount_minor: number;
  total_minor: number;
  fulfillment_option: string;
  constraints_note: string | null;
  expires_at: string;
}

export interface PaymentAttemptApi {
  attempt_id: string;
  status: "created" | "pending" | "succeeded" | "failed" | "cancelled" | "expired";
  amount_minor: number;
  provider_reference?: string | null;
}

export interface OrderApi {
  order_id: string;
  status:
    | "pending_payment"
    | "payment_verification_pending"
    | "paid"
    | "cancelled"
    | "expired"
    | "refunded";
  // The server's own verdict: `paid` requires the status AND the full amount.
  // Never infer payment from a redirect or from `status` alone (ADR 0013).
  paid: boolean;
  currency: string;
  subtotal_minor: number;
  shipping_minor: number;
  tax_minor: number;
  discount_minor: number;
  total_minor: number;
  amount_paid_minor: number;
  origin: DataOrigin;
  created_at: string;
  // `title` is a catalogue lookup added at read time; the order itself stores the id
  // and the price it was bought at, which are the facts it must preserve.
  lines: {
    variant_id: string;
    title: string;
    quantity: number;
    unit_price_minor: number;
    amount_minor: number;
  }[];
  attempts: PaymentAttemptApi[];
}

export interface PaymentHandoff {
  attempt_id: string;
  status: PaymentAttemptApi["status"];
  amount_minor: number;
  currency: string;
  provider_reference: string | null;
  // Absent when the provider call has not landed yet; the outbox retries it.
  pay_url: string | null;
}

export interface ConfirmedCheckout {
  order: OrderApi;
  payment: PaymentHandoff;
}

// ------------------------------------------------- the agent's event stream
// These mirror `commerce_common.streaming.AgentEvent`. A client renders the types
// it knows and ignores the rest, so a new event type is never a breaking change.

export type AgentEvent =
  | { type: "text_delta"; data: { text: string } }
  | { type: "tool_call"; data: { tool: string; id: string; input: unknown; label?: string } }
  | {
      type: "tool_result";
      data: {
        tool: string;
        id: string;
        summary: string;
        is_error: boolean;
        status: "ok" | "error" | "blocked";
        reason?: string;
        excerpt?: string;
      };
    }
  | { type: "ui"; data: { component: ComponentKind; payload: ComponentPayload } }
  | { type: "ui_partial"; data: { component: ComponentKind; payload: ComponentPayload; stream_id: string } }
  | { type: "cart_update"; data: { cart: AgentCart } }
  | { type: "change_update"; data: { change: unknown } }
  | { type: "progress"; data: { message: string; tool?: string; step?: number } }
  | {
      type: "turn_complete";
      data: {
        stop_reason: string | null;
        usage: Record<string, number>;
        elapsed_ms: number;
        results_cleared: number;
      };
    }
  | { type: "error"; data: { message: string } };

// The cart shape the agent emits differs from the REST one (it carries no owner,
// because the stream is already scoped to the authenticated principal).
export interface AgentCart {
  cart_id: string;
  state_version: number;
  currency: string;
  lines: CartLineApi[];
  subtotal_minor: number;
}

export type ComponentKind =
  | "products"
  | "comparison"
  | "cart"
  | "checkout"
  | "order_status"
  | "guide"
  | "suggestions";

// A card the agent presented. `item_ref` is a server-issued, session-bound handle:
// it is what a follow-up add names, and a variant id is not a substitute (ADR 0020).
export interface PresentedCard {
  variant_id: string;
  item_ref: string;
  title: string;
  brand: string;
  price_minor: number;
  price: string;
  currency: string;
  in_stock: boolean;
  options: Record<string, string>;
  reason?: string;
  is_cross_sell?: boolean;
}

export interface ProductsPayload {
  presentation_id: string;
  title: string;
  layout?: string;
  items: PresentedCard[];
}

export interface ComparisonPayload {
  presentation_id: string;
  title: string;
  entries: (PresentedCard & { pros: string[]; cons: string[]; best_for: string })[];
  recommended_variant_id: string | null;
}

export interface CartComponentPayload {
  title: string;
  note?: string | null;
  cart_id: string;
  state_version: number;
  currency: string;
  lines: (CartLineApi & { amount: string })[];
  subtotal_minor: number;
  subtotal: string;
}

export interface CheckoutComponentPayload {
  note?: string | null;
  stage_id: string;
  state: string;
  currency: string;
  lines: (CartLineApi & { amount: string })[];
  subtotal_minor: number;
  shipping_minor: number;
  tax_minor: number;
  discount_minor: number;
  total_minor: number;
  total: string;
  fulfillment_option: string;
  constraints_note: string | null;
  expires_at: string;
  // Always "host_confirm_checkout": the agent presents, the host confirms.
  confirm_action: string;
}

export interface OrderStatusPayload {
  summary: string;
  order_id: string;
  status: string;
  payment_state: string;
  placed_at: string;
  currency: string;
  total_minor: number;
  total: string;
  lines: { variant_id: string; title: string; quantity: number; unit_price_minor: number }[];
}

export interface GuidePayload {
  title: string;
  sections: { heading: string; body: string }[];
  related: PresentedCard[];
}

export interface SuggestionsPayload {
  suggestions: string[];
}

export type ComponentPayload =
  | ProductsPayload
  | ComparisonPayload
  | CartComponentPayload
  | CheckoutComponentPayload
  | OrderStatusPayload
  | GuidePayload
  | SuggestionsPayload;

// One rendered component, tagged so the renderer can narrow the payload safely.
export type RenderedComponent =
  | { kind: "products"; payload: ProductsPayload }
  | { kind: "comparison"; payload: ComparisonPayload }
  | { kind: "cart"; payload: CartComponentPayload }
  | { kind: "checkout"; payload: CheckoutComponentPayload }
  | { kind: "order_status"; payload: OrderStatusPayload }
  | { kind: "guide"; payload: GuidePayload }
  | { kind: "suggestions"; payload: SuggestionsPayload };

// A tool call the turn made, shown so a person can see what the agent actually did.
export interface ToolTrace {
  id: string;
  tool: string;
  label?: string;
  status: "running" | "ok" | "error" | "blocked";
  summary?: string;
  reason?: string;
}

// ------------------------------------------------------------------ portal

export interface Principal {
  id: string;
  email: string;
  role: "customer" | "merchant_operator";
  display_name: string | null;
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface Approval {
  id: string;
  kind: string;
  target_id: string | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  reasoning: string;
  status: ApprovalStatus;
  created_at: string;
  decided_at: string | null;
}

export interface BusinessSnapshot {
  period: string;
  currency: string;
  sales: number;
  orders: number;
  traffic: number | null;
  conversion_rate: number | null;
  average_order_value: number;
  limitations: { source: string; note: string }[];
}

export type AuditOutcome = "ok" | "pending_approval" | "approved" | "rejected" | "failed";

export interface AuditEntry {
  id: string;
  timestamp: string;
  session_id: string;
  agent: AgentKind;
  action: string;
  reasoning: string;
  outcome: AuditOutcome;
  gated: boolean;
  result: unknown;
}

// The portal still runs the pre-Phase-5 single-`message` reply shape.
export interface ChatReply {
  id: string;
  role: "agent";
  text: string;
  why?: string;
  approval?: Approval | null;
}

// UI-local chat message shape (both user + agent turns, rendered in MessageList).
export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  typing?: boolean;
  why?: string;
  // What the agent rendered this turn, in the order it rendered it.
  components?: RenderedComponent[];
  tools?: ToolTrace[];
  error?: string;
}
