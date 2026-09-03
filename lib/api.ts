import {
  Approval,
  ApprovalStatus,
  AuditEntry,
  BusinessSnapshot,
  CartApi,
  ChatReply,
  CheckoutResult,
  OrderStatus,
} from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

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
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
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

// The backend streams a single SSE "message" event followed by "done" for
// each chat turn (see api/main.py: one_event()). We read the whole stream
// and parse the one message payload out of it.
async function chat(path: "/chat/storefront" | "/chat/portal", sessionId: string, message: string): Promise<ChatReply> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, message }),
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
  const text = await res.text();
  const match = text.match(/event: message\ndata: (.+)\n/);
  if (!match) throw new ApiError("Unexpected response from chat endpoint.");
  return JSON.parse(match[1]) as ChatReply;
}

export const api = {
  chatStorefront: (sessionId: string, message: string) => chat("/chat/storefront", sessionId, message),
  chatPortal: (sessionId: string, message: string) => chat("/chat/portal", sessionId, message),

  catalog: () => req<import("@/lib/types").ApiProduct[]>("/catalog"),

  cartRead: (sessionId: string) => req<CartApi>(`/cart/${encodeURIComponent(sessionId)}`),
  cartAdd: (sessionId: string, productId: string, quantity: number, reasoning: string) =>
    req<CartApi>("/cart/items", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, product_id: productId, quantity, reasoning }),
    }),
  cartUpdate: (sessionId: string, productId: string, quantity: number, reasoning: string) =>
    req<CartApi>("/cart/items", {
      method: "PATCH",
      body: JSON.stringify({ session_id: sessionId, product_id: productId, quantity, reasoning }),
    }),
  cartRemove: (sessionId: string, productId: string) =>
    req<CartApi>(`/cart/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(productId)}`, { method: "DELETE" }),

  checkout: (sessionId: string, reasoning: string) =>
    req<CheckoutResult>("/checkout", { method: "POST", body: JSON.stringify({ session_id: sessionId, reasoning }) }),

  orderStatus: (sessionId: string, orderId: string) =>
    req<OrderStatus>(`/orders/${encodeURIComponent(sessionId)}/${encodeURIComponent(orderId)}`),

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
