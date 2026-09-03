import {
  Approval,
  ApprovalStatus,
  AuditEntry,
  BusinessSnapshot,
  CartApi,
  ChatReply,
  CheckoutResult,
  OrderStatus,
  Principal,
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

// The backend streams `text_delta` events as Claude narrates, then one
// `message` event carrying the complete reply (same shape regardless of
// whether any deltas were read), then `done` (see api/main.py: streamed_message()).
// We read the body incrementally so `onDelta` can render text as it's generated;
// turns whose text is already fully known in code (checkout, add-to-cart) simply
// emit no deltas before `message`, so `onDelta` just never fires for those.
async function chat(
  path: "/chat/storefront" | "/chat/portal",
  conversationId: string,
  message: string,
  onDelta?: (delta: string) => void
): Promise<ChatReply> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ conversation_id: conversationId, message }),
    });
  } catch {
    throw new ApiError(`Could not reach the Cartisan backend at ${BASE}. Is it running?`);
  }
  if (!res.ok || !res.body) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let payload: ChatReply | null = null;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const eventMatch = block.match(/^event: (.+)$/m);
      const dataMatch = block.match(/^data: (.+)$/m);
      if (!eventMatch || !dataMatch) continue;
      const data = JSON.parse(dataMatch[1]);
      if (eventMatch[1] === "text_delta") onDelta?.(data.delta as string);
      else if (eventMatch[1] === "message") payload = data as ChatReply;
    }
  }
  if (!payload) throw new ApiError("Unexpected response from chat endpoint.");
  return payload;
}

export const api = {
  chatStorefront: (conversationId: string, message: string, onDelta?: (delta: string) => void) =>
    chat("/chat/storefront", conversationId, message, onDelta),
  chatPortal: (conversationId: string, message: string) => chat("/chat/portal", conversationId, message),

  me: () => req<Principal>("/me"),

  catalog: () => req<import("@/lib/types").ApiProduct[]>("/catalog"),

  // Cart calls name no owner. `expectedVersion` makes a mutation fail with 409
  // rather than silently overwrite a cart that changed since it was read, and
  // `idempotencyKey` makes a retried mutation apply exactly once.
  cartRead: () => req<CartApi>("/cart"),
  cartAdd: (productId: string, quantity: number, reasoning: string, expectedVersion?: number) =>
    req<CartApi>("/cart/items", {
      method: "POST",
      body: JSON.stringify({
        product_id: productId, quantity, reasoning,
        expected_version: expectedVersion ?? null,
        idempotency_key: crypto.randomUUID(),
      }),
    }),
  cartUpdate: (productId: string, quantity: number, reasoning: string, expectedVersion?: number) =>
    req<CartApi>("/cart/items", {
      method: "PATCH",
      body: JSON.stringify({
        product_id: productId, quantity, reasoning,
        expected_version: expectedVersion ?? null,
        idempotency_key: crypto.randomUUID(),
      }),
    }),
  cartRemove: (productId: string) =>
    req<CartApi>(`/cart/items/${encodeURIComponent(productId)}`, { method: "DELETE" }),

  checkout: (reasoning: string, expectedVersion?: number) =>
    req<CheckoutResult>("/checkout", {
      method: "POST",
      body: JSON.stringify({
        reasoning,
        expected_version: expectedVersion ?? null,
        idempotency_key: crypto.randomUUID(),
      }),
    }),

  orderStatus: (orderId: string) => req<OrderStatus>(`/orders/${encodeURIComponent(orderId)}`),

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
