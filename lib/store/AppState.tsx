"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import {
  ApiProduct,
  Approval,
  ApprovalStatus,
  AuditEntry,
  BusinessSnapshot,
  CartApi,
  ChatMessage,
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

const EMPTY_CART: CartApi = { cart_id: "", customer_id: "", state_version: 0, lines: [], total: 0, currency: "INR" };

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
  sendShopperMessage: (text: string) => Promise<void>;
  addToCart: (product: ApiProduct) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  beginCheckout: () => Promise<void>;
  checkOrderStatus: (msgId: string, orderId: string) => Promise<void>;

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

  const sendShopperMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !session) return;
      setStoreMessages((s) => [...s, { id: uid("m"), role: "user", text: trimmed }]);

      // Claude's narration streams in token-by-token; give it a placeholder bubble
      // that grows live, then swap in the authoritative final message (with
      // products/cart/etc., which the backend only knows once narration finishes).
      const streamId = uid("m");
      let streaming = false;
      const reply = await guarded(() =>
        api.chatStorefront(shopperId, trimmed, (delta) => {
          setStoreMessages((s) => {
            if (!streaming) {
              streaming = true;
              return [...s, { id: streamId, role: "agent", text: delta }];
            }
            return s.map((m) => (m.id === streamId ? { ...m, text: m.text + delta } : m));
          });
        })
      );
      if (reply) {
        const finalMessage: ChatMessage = {
          id: reply.id,
          role: "agent",
          text: reply.text,
          why: reply.why,
          products: reply.products,
          checkout: reply.checkout,
          stagedCheckout: reply.stagedCheckout,
          orderStatus: reply.orderStatus,
        };
        setStoreMessages((s) => (streaming ? s.map((m) => (m.id === streamId ? finalMessage : m)) : [...s, finalMessage]));
        if (reply.cart) setCart(reply.cart);
        else await refreshCart();
      }
      await refreshAudit();
    },
    [shopperId, session, guarded, refreshCart, refreshAudit]
  );

  const addToCart = useCallback(
    async (product: ApiProduct) => {
      if (!session) return;
      const updated = await guarded(() =>
        api.cartAdd(product.id, 1, `Customer added "${product.name}" from search results`, cart.state_version)
      );
      if (updated) setCart(updated);
      refreshAudit();
    },
    [session, cart.state_version, guarded, refreshAudit]
  );

  const removeFromCart = useCallback(
    async (productId: string) => {
      if (!session) return;
      const updated = await guarded(() => api.cartRemove(productId));
      if (updated) setCart(updated);
      refreshAudit();
    },
    [session, guarded, refreshAudit]
  );

  const beginCheckout = useCallback(async () => {
    if (!session) return;
    if (cart.lines.length === 0) {
      setStoreMessages((s) => [...s, { id: uid("m"), role: "agent", text: "Your cart is empty — add something first and I'll take you to checkout." }]);
      return;
    }
    const result = await guarded(() => api.checkout("Customer requested checkout", cart.state_version));
    if (result) {
      setStoreMessages((s) => [
        ...s,
        {
          id: uid("m"),
          role: "agent",
          text: "Ready when you are — here's what you're paying for.",
          why: "Handing off to a real Razorpay test-mode payment link, created via Razorpay's official MCP tools. I never generate this link myself.",
          checkout: result,
          orderStatus: "created",
        },
      ]);
      setCart(EMPTY_CART);
    }
    refreshAudit();
  }, [session, cart.lines.length, cart.state_version, guarded, refreshAudit]);

  const checkOrderStatus = useCallback(
    async (msgId: string, orderId: string) => {
      if (!session) return;
      const order = await guarded(() => api.orderStatus(orderId));
      if (order) {
        setStoreMessages((s) => s.map((m) => (m.id === msgId ? { ...m, orderStatus: order.status } : m)));
      }
      refreshAudit();
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
    sendShopperMessage,
    addToCart,
    removeFromCart,
    beginCheckout,
    checkOrderStatus,
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
