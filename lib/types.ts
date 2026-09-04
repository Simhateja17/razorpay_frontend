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
  // Why the provider refused this attempt, when it did. Shown so a decline reads as
  // a stated reason rather than as a status that silently stopped moving.
  failure_reason?: string | null;
  // Carried on the order itself (not just the live handoff response) so a client
  // that lost its in-memory checkout state can rebuild the payment panel from
  // GET /orders/{id} alone.
  pay_url?: string | null;
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
  // The journey this purchase belongs to, and what recovery is still open to it —
  // both shown in the order view rather than only in the operator's queue (ADR 0030).
  correlation_id: string | null;
  recovery_actions: RecoveryAction[];
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
  | "suggestions"
  // The merchant surface. Both surfaces speak one event stream, so the portal and
  // the storefront differ in which components they know, not in how they listen.
  | "digest"
  | "metrics"
  | "change_preview";

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

// ------------------------------------------------------- merchant components

// Every figure the merchant agent shows says what kind of claim it is (ADR 0017).
// `causal` exists in the type because the backend gate refuses it by name; nothing
// in Cartisan produces one, so it should never arrive.
export type ClaimKind = "observed" | "estimated" | "causal";

export interface DigestPayload {
  title: string;
  items: { heading: string; body: string; claim_kind: ClaimKind }[];
  // What the turn actually read, so a reader can check the lines against the reads.
  evidence: { metrics_read: string[]; claims_read: string[]; changes_staged: string[] };
}

export interface MetricsPayload {
  title: string;
  metric: string;
  window_days: number;
  group_by: string | null;
  unit: string;
  origins: DataOrigin[];
  points: { date: string; value: number; orders?: number }[];
  total: number | null;
  total_label: string | null;
  claim_kind: ClaimKind;
  // The formula the figure came from, shown beside it rather than kept server-side.
  basis: string;
  limitations: string[];
  reading: string;
}

export interface ChangePreviewPayload {
  change_id: string;
  kind: MerchantChangeKind;
  target_type: string;
  target_id: string | null;
  status: MerchantChangeStatus;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  rationale: string;
  created_at: string;
  policy_bounds: Record<string, unknown>;
  note: string | null;
  // Always "host_decide_merchant_change": the agent previews, the operator decides.
  decision_action: string;
  approval_surface: string;
}

export type ComponentPayload =
  | ProductsPayload
  | ComparisonPayload
  | CartComponentPayload
  | CheckoutComponentPayload
  | OrderStatusPayload
  | GuidePayload
  | SuggestionsPayload
  | DigestPayload
  | MetricsPayload
  | ChangePreviewPayload;

// One rendered component, tagged so the renderer can narrow the payload safely.
export type RenderedComponent =
  | { kind: "products"; payload: ProductsPayload }
  | { kind: "comparison"; payload: ComparisonPayload }
  | { kind: "cart"; payload: CartComponentPayload }
  | { kind: "checkout"; payload: CheckoutComponentPayload }
  | { kind: "order_status"; payload: OrderStatusPayload }
  | { kind: "guide"; payload: GuidePayload }
  | { kind: "suggestions"; payload: SuggestionsPayload }
  | { kind: "digest"; payload: DigestPayload }
  | { kind: "metrics"; payload: MetricsPayload }
  | { kind: "change_preview"; payload: ChangePreviewPayload };

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

// A staged change, exactly as `merchant_changes` holds it. The agent can put one
// here and nothing else: `pending` is the only status a model-reachable path can
// produce, and approval and application are the operator's, through the host
// (ADR 0016).
export type MerchantChangeStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "applied"
  | "failed"
  | "superseded";

export type MerchantChangeKind =
  | "inventory_action"
  | "price_update"
  | "promotion"
  | "campaign"
  | "listing_update";

export interface MerchantApproval {
  id: string;
  change_id: string;
  operator_id: string;
  decision: "approved" | "rejected";
  note: string | null;
  decided_at: string;
}

export interface MerchantChange {
  id: string;
  kind: MerchantChangeKind;
  target_type: string;
  target_id: string | null;
  status: MerchantChangeStatus;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  rationale: string;
  created_at: string;
  decided_at: string | null;
  applied_at: string | null;
  approvals: MerchantApproval[];
}

// A number with everything needed to check it: the formula in `basis`, the operands
// in `inputs`, and what it cannot support in `limitations`.
export interface Claim {
  key: string;
  value: number | null;
  unit: string;
  claim_kind: ClaimKind;
  basis: string;
  inputs: Record<string, unknown>;
  limitations: string[];
  value_label?: string;
}

export interface BusinessSnapshot {
  window_days: number;
  currency: string;
  origins: DataOrigin[];
  claims: Claim[];
  movements: Claim[];
  limitations: string[];
}

/**
 * What a reconnecting client is shown (ADR 0029).
 *
 * `history` comes from the durable `turns` table, not from the model's message
 * array: that array holds tool_use/tool_result pairs only the running turn can
 * complete, and it stays in the process running the turn. This is what a person
 * needs back — what they asked, and what they were told — so a reload, or a restart
 * of the backend mid-demo, repaints the conversation instead of losing it.
 */
export interface ResumedConversation {
  state: "idle" | "received" | "running" | "awaiting_tool" | "completed" | "failed" | "abandoned";
  turn_id: string | null;
  agent_message: string | null;
  history: {
    id: string;
    sequence: number;
    state: string;
    user_message: string | null;
    agent_message: string | null;
    correlation_id: string | null;
    started_at: string;
  }[];
}

// ------------------------------------------------------------- the evidence ledger
// These replace the flat `AuditEntry`, which had no principal, no correlation, no
// origin and no actor type — so every session's rows arrived in one list. An
// evidence record has all four, which is what makes a filtered view possible at
// all (ADR 0023, ADR 0032).

export type EvidenceOutcome = "applied" | "blocked" | "unavailable" | "failed" | "conflict";
export type ActorType = "customer" | "merchant_operator" | "agent" | "system" | "provider";

export interface EvidenceRecord {
  id: string;
  recorded_at: string;
  actor_type: ActorType;
  actor_id: string | null;
  surface: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  reason: string;
  outcome: EvidenceOutcome;
  policy_checks: unknown;
  state_ref: unknown;
  prompt_version: string | null;
  skill_versions: string[] | null;
  data_origin: DataOrigin;
  demo_run_id: string | null;
  correlation_id: string | null;
  turn_id: string | null;
  tool_execution_id: string | null;
}

export interface DemoRun {
  demo_run_id: string;
  records: number;
  journeys: number;
  first_seen: string;
  last_seen: string;
}

export interface EvidenceFilters {
  demo_runs: DemoRun[];
  origins: DataOrigin[];
  actions: { action: string; count: number }[];
}

export interface JourneySummary {
  correlation_id: string;
  started_at: string;
  ended_at: string;
  records: number;
  applied: number;
  blocked: number;
  failed: number;
  conflicts: number;
  unavailable: number;
  started_by: { actor_type: ActorType | null; actor_id: string | null; surface: string | null };
  first_action: string | null;
  demo_run_id: string | null;
  origins: DataOrigin[];
  orders: { id: string; status: string; total_minor: number; origin: DataOrigin }[];
}

// One step of a journey. `source` says which record it came from, so a reader can
// tell a model action from a database transition from the provider's own answer.
export type JourneyStepSource =
  | "evidence"
  | "turn"
  | "tool"
  | "order"
  | "payment_attempt"
  | "provider_event";

export interface JourneyStep {
  source: JourneyStepSource;
  at: string | null;
  label: string;
  outcome: EvidenceOutcome | null;
  origin: DataOrigin | null;
  detail: Record<string, unknown>;
}

export interface Journey extends Partial<JourneySummary> {
  correlation_id: string;
  found: boolean;
  steps: JourneyStep[];
}

// ---------------------------------------------------------------- health metrics

export interface HealthReport {
  window_hours: number;
  demo_run_id: string | null;
  generated_at: string;
  runtime: Claim[];
  tools: Claim[];
  payments: Claim[];
  delivery: Claim[];
  tool_outcomes: {
    tool_name: string;
    outcome: EvidenceOutcome;
    count: number;
    mean_latency_ms: number;
  }[];
  origins: { data_origin: DataOrigin; count: number }[];
}

// -------------------------------------------------------------- payment recovery

export type RecoveryAction =
  | "retry_message"
  | "acknowledge"
  | "reprocess_event"
  | "retry_payment"
  | "cancel_order"
  | "await_verification";

export interface StuckOrderSummary {
  order_id: string;
  customer_id: string;
  status: OrderApi["status"];
  total_minor: number;
  amount_paid_minor: number;
  origin: DataOrigin;
  correlation_id: string | null;
  created_at: string;
  recovery_actions?: RecoveryAction[];
}

export interface DeadLetter {
  message_id: string;
  topic: string;
  attempts: number;
  last_error: string | null;
  correlation_id: string | null;
  created_at: string;
  payload: Record<string, unknown>;
  order_id: string | null;
  order: StuckOrderSummary | null;
  recovery_actions: RecoveryAction[];
}

export interface ProviderEventRow {
  inbox_id: string;
  provider: string;
  provider_event_id: string;
  event_type: string;
  status: "received" | "processed" | "ignored" | "quarantined";
  quarantine_reason: string | null;
  correlation_id: string | null;
  received_at: string;
  processed_at: string | null;
  payload: Record<string, unknown>;
  order: StuckOrderSummary | null;
  recovery_actions: RecoveryAction[];
}

export interface RecoveryQueue {
  dead_letters: DeadLetter[];
  quarantined: ProviderEventRow[];
  unprocessed: ProviderEventRow[];
  stuck_orders: StuckOrderSummary[];
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
