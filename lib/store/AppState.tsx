"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import {
  Approval,
  ApprovalStatus,
  AuditEntry,
  BusinessSnapshot,
  CartApi,
  ChatMessage,
  ConfirmedCheckout,
  ComponentKind,
  ComponentPayload,
  OrderApi,
  RenderedComponent,
  StagedCheckout,
} from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { uid } from "@/lib/format";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

// A conversation id groups a chat thread for narration and audit only. It carries
// no authority: the cart, orders, and checkout all belong to the signed-in
// customer, so the same shopper sees one cart across every conversation and tab.
function conversationId(key: string): string {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const fresh = `${key}_${crypto.randomUUID().slice(0, 8)}`;
  window.localStorage.setItem(key, fresh);
  return fresh;
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong talking to the backend.";
}

const EMPTY_CART: CartApi = {
  cart_id: "", customer_id: "", state_version: 0, lines: [], subtotal_minor: 0, currency: "INR",
};

// The components the storefront knows how to draw. An event naming anything else is
// dropped rather than rendered blank — the stream contract is "render what you know".
const RENDERABLE: ReadonlySet<ComponentKind> = new Set<ComponentKind>([
  "products", "comparison", "cart", "checkout", "order_status", "guide", "suggestions",
]);

function asComponent(component: string, payload: ComponentPayload): RenderedComponent | null {
  return RENDERABLE.has(component as ComponentKind)
    ? ({ kind: component, payload } as RenderedComponent)
    : null;
}

interface AppState {
  backendError: string | null;

  // identity
  session: Session | null;
  authReady: boolean;
  authConfigured: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;

  // storefront
  storeMessages: ChatMessage[];
  cart: CartApi;
  turnActive: boolean;
  progress: string | null;
  stage: StagedCheckout | null;
  checkout: ConfirmedCheckout | null;
  checkoutError: string | null;
  sendShopperMessage: (text: string) => Promise<void>;
  addToCart: (variantId: string, title: string) => Promise<void>;
  removeFromCart: (variantId: string) => Promise<void>;
  updateQuantity: (variantId: string, quantity: number) => Promise<void>;
  beginCheckout: () => Promise<void>;
  confirmCheckout: (stageId: string) => Promise<void>;
  cancelStage: () => void;
  retryPayment: (orderId: string) => Promise<void>;
  refreshOrder: (orderId: string) => Promise<OrderApi | undefined>;
  paymentReturned: (orderId: string) => Promise<void>;
  dismissCheckout: () => void;

  // portal
  portalMessages: ChatMessage[];
  snapshot: BusinessSnapshot | null;
  approvals: Approval[];
  sendMerchantMessage: (text: string) => Promise<void>;
  decideApproval: (id: string, decision: ApprovalStatus) => Promise<void>;

  // audit
  audit: AuditEntry[];
  refreshAudit: () => Promise<void>;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [shopperId] = useState(() => conversationId("cartisan_shopper"));
  const [merchantId] = useState(() => conversationId("cartisan_merchant"));
  const [backendError, setBackendError] = useState<string | null>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);

  const [storeMessages, setStoreMessages] = useState<ChatMessage[]>([]);
  const [cart, setCart] = useState<CartApi>(EMPTY_CART);
  const [turnActive, setTurnActive] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [stage, setStage] = useState<StagedCheckout | null>(null);
  const [checkout, setCheckout] = useState<ConfirmedCheckout | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [portalMessages, setPortalMessages] = useState<ChatMessage[]>([]);
  const [snapshot, setSnapshot] = useState<BusinessSnapshot | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);

  const [audit, setAudit] = useState<AuditEntry[]>([]);


  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    if (!supabase) return "Supabase Auth is not configured in this build.";
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setCart(EMPTY_CART);
    setStoreMessages([]);
    // Nothing belonging to the previous principal survives the sign-out.
    setStage(null);
    setCheckout(null);
    setCheckoutError(null);
  }, []);


  const guarded = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      const result = await fn();
      setBackendError(null);
      return result;
    } catch (e) {
      setBackendError(errorMessage(e));
      return undefined;
    }
  }, []);

  const refreshAudit = useCallback(async () => {
    await guarded(async () => {
      const rows = await api.audit();
      setAudit(rows);
    });
  }, [guarded]);

  const refreshCart = useCallback(async () => {
    if (!session) return;
    await guarded(async () => setCart(await api.cartRead()));
  }, [session, guarded]);

  // The cart is re-read whenever the principal changes, so signing in or out
  // never leaves another shopper's cart on screen.
  // Signing out clears the cart explicitly, so this effect only ever loads a cart
  // for a present principal — it never has to blank one out mid-render.
  useEffect(() => {
    if (!session) return;
    let active = true;
    api.cartRead()
      .then((next) => {
        if (!active) return;
        setCart(next);
        setBackendError(null);
      })
      .catch((error) => {
        if (active) setBackendError(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    let active = true;
    api.approvals()
      .then((next) => {
        if (!active) return;
        setApprovals(next);
        setBackendError(null);
      })
      .catch((error) => {
        if (active) setBackendError(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (merchantId === "server") return;
    let active = true;
    api.portalSnapshot(merchantId)
      .then((next) => {
        if (!active) return;
        setSnapshot(next);
        setBackendError(null);
      })
      .catch((error) => {
        if (active) setBackendError(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [merchantId]);

  useEffect(() => {
    let active = true;
    api.audit()
      .then((next) => {
        if (!active) return;
        setAudit(next);
        setBackendError(null);
      })
      .catch((error) => {
        if (active) setBackendError(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, []);

  /**
   * Run one agent turn, rendering its event stream as it arrives.
   *
   * The turn is the events. Text accumulates into one growing bubble; each `ui`
   * event appends a component to that same message in the order the agent emitted
   * it; `cart_update` replaces the cart wholesale (the server's cart is the cart);
   * and `turn_complete` closes it. Anything unrecognised is ignored on purpose —
   * that is what lets the backend add an event type without breaking this client.
   */
  const sendShopperMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !session || turnActive) return;
      setStoreMessages((s) => [...s, { id: uid("m"), role: "user", text: trimmed }]);

      const replyId = uid("m");
      setStoreMessages((s) => [...s, { id: replyId, role: "agent", text: "", typing: true }]);
      setTurnActive(true);
      setProgress(null);

      const patch = (update: (m: ChatMessage) => ChatMessage) =>
        setStoreMessages((s) => s.map((m) => (m.id === replyId ? update(m) : m)));

      // The agent narrates across rounds: text, a tool call, then more text. Those
      // are separate thoughts, so the second one starts a new paragraph instead of
      // running into the end of the first ("…across budgets:Let me know which…").
      let brokeForTool = false;

      try {
        for await (const event of api.chatStorefront(shopperId, trimmed)) {
          switch (event.type) {
            case "text_delta": {
              const separator = brokeForTool && event.data.text.trim() ? "\n\n" : "";
              brokeForTool = false;
              patch((m) => ({
                ...m,
                text: m.text + (m.text ? separator : "") + event.data.text,
                typing: false,
              }));
              break;
            }

            case "tool_call":
              brokeForTool = true;
              patch((m) => ({
                ...m,
                tools: [
                  ...(m.tools ?? []),
                  { id: event.data.id, tool: event.data.tool, label: event.data.label, status: "running" },
                ],
              }));
              break;

            case "tool_result":
              patch((m) => ({
                ...m,
                tools: (m.tools ?? []).map((t) =>
                  t.id === event.data.id
                    ? { ...t, status: event.data.status, summary: event.data.summary, reason: event.data.reason }
                    : t
                ),
              }));
              setProgress(null);
              break;

            case "ui": {
              const component = asComponent(event.data.component, event.data.payload);
              if (component) {
                patch((m) => ({
                  ...m,
                  typing: false,
                  components: [...(m.components ?? []), component],
                }));
              }
              break;
            }

            case "cart_update":
              // The agent changed the cart; the panel is the same row, so it moves too.
              setCart((current) => ({
                ...current,
                ...event.data.cart,
                customer_id: current.customer_id,
              }));
              break;

            case "progress":
              setProgress(event.data.message);
              break;

            case "error":
              patch((m) => ({ ...m, typing: false, error: event.data.message }));
              break;

            case "turn_complete":
              patch((m) => ({ ...m, typing: false }));
              break;

            // `ui_partial` and `change_update` are not rendered by the storefront:
            // a half-built card is worse than a card that appears when it is ready.
            default:
              break;
          }
        }
        setBackendError(null);
      } catch (e) {
        patch((m) => ({ ...m, typing: false, error: errorMessage(e) }));
        setBackendError(errorMessage(e));
      } finally {
        setTurnActive(false);
        setProgress(null);
      }

      // The turn may have staged a checkout or changed the cart through a path that
      // emitted no event; re-reading is cheap and keeps the panel honest.
      await refreshCart();
      await refreshAudit();
    },
    [shopperId, session, turnActive, refreshCart, refreshAudit]
  );

  const addToCart = useCallback(
    async (variantId: string, title: string) => {
      if (!session) return;
      const updated = await guarded(() =>
        api.cartAdd(variantId, 1, `Customer added "${title}"`, cart.state_version)
      );
      if (updated) setCart(updated);
      refreshAudit();
    },
    [session, cart.state_version, guarded, refreshAudit]
  );

  const removeFromCart = useCallback(
    async (variantId: string) => {
      if (!session) return;
      const updated = await guarded(() => api.cartRemove(variantId));
      if (updated) setCart(updated);
      refreshAudit();
    },
    [session, guarded, refreshAudit]
  );

  const updateQuantity = useCallback(
    async (variantId: string, quantity: number) => {
      if (!session) return;
      const updated = await guarded(() =>
        api.cartUpdate(variantId, quantity, "Customer changed the quantity", cart.state_version)
      );
      if (updated) setCart(updated);
      refreshAudit();
    },
    [session, cart.state_version, guarded, refreshAudit]
  );

  /** Price the cart into an expiring preview. Holds no stock and moves no money. */
  const beginCheckout = useCallback(async () => {
    if (!session || cart.lines.length === 0) return;
    setCheckoutError(null);
    try {
      setStage(await api.stageCheckout());
      setBackendError(null);
    } catch (e) {
      setCheckoutError(errorMessage(e));
    }
    refreshAudit();
  }, [session, cart.lines.length, refreshAudit]);

  /**
   * The customer's confirmation. This is what creates the order and reserves the
   * stock, and it is deliberately a separate, explicit act from staging (ADR 0012).
   */
  const confirmCheckout = useCallback(
    async (stageId: string) => {
      if (!session) return;
      setCheckoutError(null);
      try {
        const confirmed = await api.confirmCheckout(stageId);
        setCheckout(confirmed);
        setStage(null);
        // The cart was retired server-side along with the order.
        setCart((current) => ({ ...current, lines: [], subtotal_minor: 0 }));
        await refreshCart();
        setBackendError(null);
      } catch (e) {
        // A refusal here means nothing was created: no order, no hold, no charge.
        setCheckoutError(errorMessage(e));
        await refreshCart();
      }
      refreshAudit();
    },
    [session, refreshCart, refreshAudit]
  );

  const cancelStage = useCallback(() => {
    setStage(null);
    setCheckoutError(null);
  }, []);

  /** Try again on the same internal order — never a second order (ADR 0030). */
  const retryPayment = useCallback(
    async (orderId: string) => {
      if (!session) return;
      setCheckoutError(null);
      try {
        const payment = await api.retryPayment(orderId);
        const order = await api.orderStatus(orderId);
        setCheckout({ order, payment });
        setBackendError(null);
      } catch (e) {
        setCheckoutError(errorMessage(e));
      }
      refreshAudit();
    },
    [session, refreshAudit]
  );

  /**
   * The customer has left for Razorpay. Record that they went, which moves the order
   * to `payment_verification_pending` — a state that explicitly is NOT paid and that
   * only a verified provider event can advance (ADR 0013).
   */
  const paymentReturned = useCallback(
    async (orderId: string) => {
      if (!session) return;
      const order = await guarded(() => api.paymentRedirectReturned(orderId));
      if (order) setCheckout((c) => (c && c.order.order_id === orderId ? { ...c, order } : c));
    },
    [session, guarded]
  );

  const dismissCheckout = useCallback(() => {
    setCheckout(null);
    setCheckoutError(null);
  }, []);

  const refreshOrder = useCallback(
    async (orderId: string): Promise<OrderApi | undefined> => {
      if (!session) return undefined;
      const order = await guarded(() => api.orderStatus(orderId));
      if (order) setCheckout((c) => (c && c.order.order_id === orderId ? { ...c, order } : c));
      refreshAudit();
      return order;
    },
    [session, guarded, refreshAudit]
  );

  const sendMerchantMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || merchantId === "server") return;
      setPortalMessages((s) => [...s, { id: uid("m"), role: "user", text: trimmed }]);
      const reply = await guarded(() => api.chatPortal(merchantId, trimmed));
      if (reply) {
        setPortalMessages((s) => [...s, { id: reply.id, role: "agent", text: reply.text, why: reply.why }]);
      }
      const snap = await guarded(() => api.portalSnapshot(merchantId));
      if (snap) setSnapshot(snap);
      refreshAudit();
    },
    [merchantId, guarded, refreshAudit]
  );

  const decideApproval = useCallback(
    async (id: string, decision: ApprovalStatus) => {
      if (merchantId === "server") return;
      const updated = await guarded(() => api.decide(id, merchantId, decision));
      if (updated) setApprovals((s) => s.map((a) => (a.id === id ? updated : a)));
      refreshAudit();
    },
    [merchantId, guarded, refreshAudit]
  );

  const value: AppState = {
    backendError,
    session,
    authReady,
    authConfigured: supabaseConfigured,
    signIn,
    signOut,
    storeMessages,
    cart,
    turnActive,
    progress,
    stage,
    checkout,
    checkoutError,
    sendShopperMessage,
    addToCart,
    removeFromCart,
    updateQuantity,
    beginCheckout,
    confirmCheckout,
    cancelStage,
    retryPayment,
    refreshOrder,
    paymentReturned,
    dismissCheckout,
    portalMessages,
    snapshot,
    approvals,
    sendMerchantMessage,
    decideApproval,
    audit,
    refreshAudit,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
