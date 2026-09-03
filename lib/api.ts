import {
  AgentEvent,
  ApiProduct,
  Approval,
  ApprovalStatus,
  AuditEntry,
  BusinessSnapshot,
  CartApi,
  ChatReply,
  ConfirmedCheckout,
  OrderApi,
  PaymentHandoff,
  Principal,
  StagedCheckout,
} from "@/lib/types";

import { accessToken } from "@/lib/supabase";

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
      headers: { "Content-Type": "application/json", ...(await authHeaders()), ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(`Could not reach the Cartisan backend at ${BASE}. Is it running?`);
  }
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
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(`Could not reach the Cartisan backend at ${BASE}. Is it running?`);
  }
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

/** The portal still runs the pre-Phase-5 shape: deltas, then one `message`. */
async function chatPortal(conversationId: string, message: string): Promise<ChatReply> {
  let payload: ChatReply | null = null;
  for await (const frame of sseStream("/chat/portal", {
    conversation_id: conversationId,
    message,
  })) {
    if (frame.event === "message") payload = frame.data as ChatReply;
  }
  if (!payload) throw new ApiError("Unexpected response from the portal chat endpoint.");
  return payload;
}

export const api = {
  chatStorefront,
  chatPortal,

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
  confirmCheckout: (stageId: string) =>
    req<ConfirmedCheckout>("/checkout/confirm", {
      method: "POST",
      body: JSON.stringify({ stage_id: stageId, idempotency_key: crypto.randomUUID() }),
    }),

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

  portalSnapshot: (sessionId: string) => req<BusinessSnapshot>(`/portal/snapshot?session_id=${encodeURIComponent(sessionId)}`),
  approvals: () => req<Approval[]>("/portal/approvals"),
  decide: (changeId: string, sessionId: string, decision: ApprovalStatus) =>
    req<Approval>(`/portal/approvals/${encodeURIComponent(changeId)}/decision`, {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, decision }),
    }),

  audit: (agent?: "shopping" | "merchant") => req<AuditEntry[]>(`/audit${agent ? `?agent=${agent}` : ""}`),
};

export { ApiError };
