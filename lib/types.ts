// Types matching the real Cartisan backend (backend/api/main.py, backend/marketplace_backend/*).
// This replaced an earlier mock-only contract once the backend was live — see AGENT_SYNC.md.

export type AgentKind = "shopping" | "merchant";

export interface ApiProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  rating?: string;
  image_label: string;
  cross_sell_of?: string | null;
  in_stock: boolean;
  price_label: string;
  meta: string;
  variants: ApiProduct[] | null;
}

export interface ChatReply {
  id: string;
  role: "agent";
  text: string;
  why?: string;
  products?: ApiProduct[];
  checkout?: CheckoutResult;
  stagedCheckout?: CheckoutStage;
  orderStatus?: string;
  cart?: CartApi;
}

export interface CartLineApi {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  amount: number;
}

export interface Principal {
  id: string;
  email: string;
  role: "customer" | "merchant_operator";
  display_name: string | null;
}

export interface CartApi {
  // The cart is owned by the authenticated customer, not by a conversation.
  cart_id: string;
  customer_id: string;
  // Bumped by every mutation; pass it back as `expected_version` to make a
  // concurrent change a visible 409 rather than a lost update.
  state_version: number;
  lines: CartLineApi[];
  total: number;
  currency: string;
}

export type CheckoutStage = CartApi;

export interface CheckoutResult {
  order_id: string;
  payment_link_id: string;
  pay_url: string;
  lines: CartLineApi[];
  total: number;
  currency: string;
}

export interface OrderStatus {
  id: string;
  customer_id: string;
  status: string; // "created" | "paid" | "failed" | "cancelled" | "expired" ...
  total: number;
  payment_link_id: string;
  pay_url: string;
  cart_json: string;
  created_at: string;
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

// UI-local chat message shape (both user + agent turns, rendered in MessageList).
export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  typing?: boolean;
  why?: string;
  products?: ApiProduct[];
  checkout?: CheckoutResult;
  stagedCheckout?: CheckoutStage;
  orderStatus?: string;
  error?: string;
}
