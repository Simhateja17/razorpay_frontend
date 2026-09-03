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

function sessionId(key: string): string {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const fresh = `${key}_${crypto.randomUUID().slice(0, 8)}`;
  window.localStorage.setItem(key, fresh);
  return fresh;
}

const EMPTY_CART: CartApi = { lines: [], total: 0, currency: "INR" };

interface AppState {
  backendError: string | null;

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
  const [shopperId, setShopperId] = useState("server");
  const [merchantId, setMerchantId] = useState("server");
  const [backendError, setBackendError] = useState<string | null>(null);

  const [storeMessages, setStoreMessages] = useState<ChatMessage[]>([]);
  const [cart, setCart] = useState<CartApi>(EMPTY_CART);

  const [portalMessages, setPortalMessages] = useState<ChatMessage[]>([]);
  const [snapshot, setSnapshot] = useState<BusinessSnapshot | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);

  const [audit, setAudit] = useState<AuditEntry[]>([]);

  useEffect(() => {
    setShopperId(sessionId("cartisan_shopper"));
    setMerchantId(sessionId("cartisan_merchant"));
  }, []);

  const guarded = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      const result = await fn();
      setBackendError(null);
      return result;
    } catch (e) {
      setBackendError(e instanceof ApiError ? e.message : "Something went wrong talking to the backend.");
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
    if (shopperId === "server") return;
    await guarded(async () => setCart(await api.cartRead(shopperId)));
  }, [shopperId, guarded]);

  const refreshApprovals = useCallback(async () => {
    await guarded(async () => setApprovals(await api.approvals()));
  }, [guarded]);

  useEffect(() => {
    if (shopperId === "server") return;
    refreshCart();
  }, [shopperId, refreshCart]);

  useEffect(() => {
    refreshApprovals();
  }, [refreshApprovals]);

  useEffect(() => {
    if (merchantId === "server") return;
    guarded(async () => setSnapshot(await api.portalSnapshot(merchantId)));
  }, [merchantId, guarded]);

  useEffect(() => {
    refreshAudit();
  }, [refreshAudit]);

  const sendShopperMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || shopperId === "server") return;
      setStoreMessages((s) => [...s, { id: uid("m"), role: "user", text: trimmed }]);
      const reply = await guarded(() => api.chatStorefront(shopperId, trimmed));
      if (reply) {
        setStoreMessages((s) => [...s, { id: reply.id, role: "agent", text: reply.text, why: reply.why, products: reply.products }]);
      }
    },
    [shopperId, guarded]
  );

  const addToCart = useCallback(
    async (product: ApiProduct) => {
      if (shopperId === "server") return;
      const updated = await guarded(() => api.cartAdd(shopperId, product.id, 1, `Customer added "${product.name}" from search results`));
      if (updated) setCart(updated);
      refreshAudit();
    },
    [shopperId, guarded, refreshAudit]
  );

  const removeFromCart = useCallback(
    async (productId: string) => {
      if (shopperId === "server") return;
      const updated = await guarded(() => api.cartRemove(shopperId, productId));
      if (updated) setCart(updated);
      refreshAudit();
    },
    [shopperId, guarded, refreshAudit]
  );

  const beginCheckout = useCallback(async () => {
    if (shopperId === "server") return;
    if (cart.lines.length === 0) {
      setStoreMessages((s) => [...s, { id: uid("m"), role: "agent", text: "Your cart is empty — add something first and I'll take you to checkout." }]);
      return;
    }
    const result = await guarded(() => api.checkout(shopperId, "Customer requested checkout"));
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
  }, [shopperId, cart.lines.length, guarded, refreshAudit]);

  const checkOrderStatus = useCallback(
    async (msgId: string, orderId: string) => {
      if (shopperId === "server") return;
      const order = await guarded(() => api.orderStatus(shopperId, orderId));
      if (order) {
        setStoreMessages((s) => s.map((m) => (m.id === msgId ? { ...m, orderStatus: order.status } : m)));
      }
      refreshAudit();
    },
    [shopperId, guarded, refreshAudit]
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
