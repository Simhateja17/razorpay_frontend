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
}

export interface CartLineApi {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  amount: number;
}

export interface CartApi {
  lines: CartLineApi[];
  total: number;
  currency: string;
}

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
  session_id: string;
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
  orderStatus?: string;
  error?: string;
}
