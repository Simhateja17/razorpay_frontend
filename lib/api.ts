import {
  AgentEvent,
  ApiProduct,
  BusinessSnapshot,
  CartApi,
  ConfirmedCheckout,
  DataOrigin,
  ConversationSummary,
  EvidenceFilters,
  EvidenceRecord,
  HealthReport,
  Journey,
  JourneySummary,
  MerchantChange,
  MetricsPayload,
  OrderApi,
  PaymentHandoff,
  Principal,
  RecoveryQueue,
  ResumedConversation,
  StagedCheckout,
} from "@/lib/types";

import { accessToken } from "@/lib/supabase";

// One lineage per demo session (ADR 0032).
//
// The correlation id groups a *journey* — the browser action, the turn it starts,
// the checkout it stages, and the provider event that settles it. It is minted by
// the server on the first call and echoed back; sending it again on the next call
// is what joins those calls into one story instead of four.
//
// The demo run id groups a whole visit, so an audit view can be narrowed to this
// session and exclude every other one. Neither carries any authority: identity is
// the bearer token and nothing else, which is exactly why these can live in the
// browser at all.
const CORRELATION_HEADER = "X-Cartisan-Correlation-Id";
const DEMO_RUN_HEADER = "X-Cartisan-Demo-Run";
const DEMO_RUN_KEY = "cartisan.demo_run_id";

let currentCorrelationId: string | null = null;

/** The demo run for this browser session, created once and kept for the tab. */
function demoRunId(): string {
  if (typeof window === "undefined") return "";
  let value = window.sessionStorage.getItem(DEMO_RUN_KEY);
  if (!value) {
    value = `demo:${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}`;
    window.sessionStorage.setItem(DEMO_RUN_KEY, value);
  }
  return value;
}

function lineageHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const run = demoRunId();
  if (run) headers[DEMO_RUN_HEADER] = run;
  if (currentCorrelationId) headers[CORRELATION_HEADER] = currentCorrelationId;
  return headers;
}

function rememberLineage(res: Response): void {
  const id = res.headers.get(CORRELATION_HEADER);
  if (id) currentCorrelationId = id;
}

/**
 * Start a new journey.
 *
 * Called when the customer begins something genuinely new — a fresh chat turn, a
 * checkout — so that a whole afternoon of browsing does not collapse into one
 * enormous "journey" a judge cannot read.
 */
function beginJourney(): void {
  currentCorrelationId = null;
}

/** The journey currently being recorded, for a UI that wants to link to it. */
function currentJourney(): string | null {
  return currentCorrelationId;
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

// Identity travels as a verified bearer token and nothing else. No shopper id is
// ever sent in a URL or body: the backend resolves the principal from the token,
// so the cart the browser renders is the cart the agent reads.
async function authHeaders(): Promise<Record<string, string>> {
  const token = await accessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
        ...lineageHeaders(),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(`Could not reach the Cartisan backend at ${BASE}. Is it running?`);
  }
  rememberLineage(res);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

/** Open an SSE stream and yield each frame as it arrives. */
async function* sseStream(path: string, body: unknown): AsyncGenerator<{ event: string; data: unknown }> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()), ...lineageHeaders() },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(`Could not reach the Cartisan backend at ${BASE}. Is it running?`);
  }
  rememberLineage(res);
  if (!res.ok || !res.body) {
    let detail = res.statusText;
    try {
      const parsed = await res.json();
      detail = parsed.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary: number;
    // Frames are separated by a blank line; a `data:` payload is always one line.
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const eventMatch = block.match(/^event: (.+)$/m);
      const dataMatch = block.match(/^data: (.+)$/m);
      if (!eventMatch || !dataMatch) continue;
      try {
        yield { event: eventMatch[1], data: JSON.parse(dataMatch[1]) };
      } catch {
        // A frame we cannot parse is skipped rather than failing the whole turn.
      }
    }
  }
}

/**
 * One storefront turn, as a stream of `commerce_common.streaming.AgentEvent`s.
 *
 * The caller renders the event types it knows and ignores the rest — that is the
 * contract, and it is what lets the backend add an event type without breaking
 * this client. There is no final "whole reply" message: the turn IS the events,
 * and `turn_complete` closes it.
 */
async function* chatStorefront(
  conversationId: string,
  message: string
): AsyncGenerator<AgentEvent> {
  for await (const frame of sseStream("/chat/storefront", {
    conversation_id: conversationId,
    message,
  })) {
    if (frame.event === "done") return;
    yield { type: frame.event, data: frame.data } as AgentEvent;
  }
}

/**
 * One merchant turn, as the same `AgentEvent` stream the storefront speaks.
 *
 * The portal used to receive one `message` frame carrying a whole reply and an
 * optional approval. It now receives the turn as it happens — the reads the agent
 * made, the components it rendered, and a `change_update` when it staged something.
 * Nothing in this stream can approve or apply a change; that is a separate,
 * operator-authenticated call (ADR 0016).
 */
async function* chatPortal(
  conversationId: string,
  message: string
): AsyncGenerator<AgentEvent> {
  for await (const frame of sseStream("/chat/portal", {
    conversation_id: conversationId,
    message,
  })) {
    if (frame.event === "done") return;
    yield { type: frame.event, data: frame.data } as AgentEvent;
  }
}

export const api = {
  chatStorefront,
  chatPortal,
  beginJourney,
  currentJourney,
  demoRunId,

  me: () => req<Principal>("/me"),

  catalog: () => req<ApiProduct[]>("/catalog"),

  // Cart calls name no owner and no product — only a variant, which is the id the
  // cart, the stage and the order all share. `expectedVersion` makes a mutation
  // fail with 409 rather than silently overwrite a cart that changed since it was
  // read, and `idempotencyKey` makes a retried mutation apply exactly once.
  cartRead: () => req<CartApi>("/cart"),
  cartAdd: (variantId: string, quantity: number, reasoning: string, expectedVersion?: number) =>
    req<CartApi>("/cart/items", {
      method: "POST",
      body: JSON.stringify({
        variant_id: variantId, quantity, reasoning,
        expected_version: expectedVersion ?? null,
        idempotency_key: crypto.randomUUID(),
      }),
    }),
  cartUpdate: (variantId: string, quantity: number, reasoning: string, expectedVersion?: number) =>
    req<CartApi>("/cart/items", {
      method: "PATCH",
      body: JSON.stringify({
        variant_id: variantId, quantity, reasoning,
        expected_version: expectedVersion ?? null,
        idempotency_key: crypto.randomUUID(),
      }),
    }),
  cartRemove: (variantId: string) =>
    req<CartApi>(`/cart/items/${encodeURIComponent(variantId)}`, { method: "DELETE" }),

  // Checkout is three calls, because they have three different authorities behind
  // them: staging previews and holds nothing, confirming is the customer's act and
  // the only thing that reserves stock, and the payment link is the host's to
  // request. The agent can reach the first and none of the rest (ADR 0005).
  stageCheckout: (fulfillmentOption = "standard", note?: string) =>
    req<StagedCheckout>("/checkout/stage", {
      method: "POST",
      body: JSON.stringify({ fulfillment_option: fulfillmentOption, note: note ?? null }),
    }),
  // The key is derived from stage_id, not freshly generated, so a duplicate
  // confirm for the *same* stage (double click, retried request) replays the
  // first result instead of racing it and losing to a TransitionError.
  confirmCheckout: (stageId: string) =>
    req<ConfirmedCheckout>("/checkout/confirm", {
      method: "POST",
      body: JSON.stringify({ stage_id: stageId, idempotency_key: `confirm:${stageId}` }),
    }),

  // What a reconnecting client should show. The transcript comes from the durable
  // `turns` table, so it survives a reload and a restart of the backend (ADR 0029).
  resumeStorefront: (conversationId: string) =>
    req<ResumedConversation>(
      `/chat/storefront/resume?conversation_id=${encodeURIComponent(conversationId)}`
    ),
  storefrontConversations: () =>
    req<ConversationSummary[]>("/chat/storefront/conversations"),
  resumePortal: (conversationId: string) =>
    req<ResumedConversation>(
      `/chat/portal/resume?conversation_id=${encodeURIComponent(conversationId)}`
    ),
  portalConversations: () =>
    req<ConversationSummary[]>("/chat/portal/conversations"),

  orders: () => req<OrderApi[]>("/orders"),
  orderStatus: (orderId: string) => req<OrderApi>(`/orders/${encodeURIComponent(orderId)}`),
  // A retry is a new attempt on the SAME order, never a second order.
  retryPayment: (orderId: string) =>
    req<PaymentHandoff>(`/orders/${encodeURIComponent(orderId)}/payment`, { method: "POST" }),
  // Coming back from Razorpay proves the customer returned, and nothing more: it
  // moves the order to `payment_verification_pending` and waits for a verified
  // event. Never render this as paid (ADR 0013).
  paymentRedirectReturned: (orderId: string) =>
    req<OrderApi>(`/orders/${encodeURIComponent(orderId)}/redirect`, { method: "POST" }),

  // The merchant surface. Every call below needs an operator principal; the token
  // says who that is, and no session or operator id is ever sent in a body.
  portalSnapshot: (windowDays = 7) =>
    req<BusinessSnapshot>(`/portal/snapshot?window_days=${windowDays}`),
  portalMetrics: (metric: string, windowDays = 30, groupBy?: string) =>
    req<MetricsPayload>(
      `/portal/metrics?metric=${encodeURIComponent(metric)}&window_days=${windowDays}` +
        (groupBy ? `&group_by=${encodeURIComponent(groupBy)}` : "")
    ),
  changes: () => req<MerchantChange[]>("/portal/changes"),
  // Approving is also the instruction to apply. The server re-reads the record and
  // re-checks the bounds first, so this can come back 409 with the reason — a stale
  // proposal or a bound that no longer holds. Nothing is written in that case.
  decideChange: (changeId: string, decision: "approved" | "rejected", note?: string) =>
    req<MerchantChange>(`/portal/changes/${encodeURIComponent(changeId)}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, note: note ?? null }),
    }),

  // The evidence ledger. `/audit` and the flat table behind it are gone: they could
  // not be filtered by principal, carried no correlation and no origin, and so could
  // only ever show a judge every session at once (ADR 0023).
  myEvidence: (params: { demoRunId?: string; correlationId?: string; limit?: number } = {}) =>
    req<EvidenceRecord[]>(`/evidence${query({
      demo_run_id: params.demoRunId,
      correlation_id: params.correlationId,
      limit: params.limit,
    })}`),
  myJourney: (correlationId: string) =>
    req<Journey>(`/evidence/journeys/${encodeURIComponent(correlationId)}`),

  // The operator's views. These take a principal as a filter rather than forcing
  // their own, because an operator acts on the whole store.
  portalEvidence: (params: {
    actorId?: string;
    demoRunId?: string;
    correlationId?: string;
    origin?: DataOrigin;
    surface?: string;
    outcome?: string;
    actorType?: string;
    action?: string;
    limit?: number;
  } = {}) =>
    req<EvidenceRecord[]>(`/portal/evidence${query({
      actor_id: params.actorId,
      demo_run_id: params.demoRunId,
      correlation_id: params.correlationId,
      origin: params.origin,
      surface: params.surface,
      outcome: params.outcome,
      actor_type: params.actorType,
      action: params.action,
      limit: params.limit,
    })}`),
  evidenceFilters: (demoRunId?: string) =>
    req<EvidenceFilters>(`/portal/evidence/filters${query({ demo_run_id: demoRunId })}`),
  journeys: (params: { actorId?: string; demoRunId?: string; origin?: DataOrigin; limit?: number } = {}) =>
    req<JourneySummary[]>(`/portal/evidence/journeys${query({
      actor_id: params.actorId,
      demo_run_id: params.demoRunId,
      origin: params.origin,
      limit: params.limit,
    })}`),
  journey: (correlationId: string) =>
    req<Journey>(`/portal/evidence/journeys/${encodeURIComponent(correlationId)}`),

  health: (hours = 24, demoRunId?: string) =>
    req<HealthReport>(`/portal/health${query({ hours, demo_run_id: demoRunId })}`),

  // Reading what is stuck needs an operator. Acting on it needs the operations
  // token, which the browser does not have and is not given: a recovery control is
  // host-triggered by design, so the UI shows what is wrong and names the command
  // that fixes it (ADR 0005).
  recoveryQueue: () => req<RecoveryQueue>("/portal/recovery"),
};

/** Build a query string from the params that were actually supplied. */
function query(params: Record<string, string | number | undefined | null>): string {
  const pairs = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );
  return pairs.length
    ? `?${pairs.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")}`
    : "";
}

export { ApiError };
