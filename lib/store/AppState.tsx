"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import {
  EvidenceRecord,
  BusinessSnapshot,
  CartApi,
  ChatMessage,
  ConfirmedCheckout,
  ComponentKind,
  ComponentPayload,
  ConversationSummary,
  MerchantChange,
  OrderApi,
  RenderedComponent,
  StagedCheckout,
} from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { uid } from "@/lib/format";
import { roleFromMetadata } from "@/lib/role-surface";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

// A conversation id groups a chat thread for narration and evidence only. It carries
// no authority: the cart, orders, and checkout all belong to the signed-in
// customer, so the same shopper sees one cart across every conversation and tab.
function conversationId(key: string): string {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  return newConversationId(key);
}

function newConversationId(key: string): string {
  const fresh = `${key}_${crypto.randomUUID().slice(0, 8)}`;
  if (typeof window !== "undefined") window.localStorage.setItem(key, fresh);
  return fresh;
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong talking to the backend.";
}

const EMPTY_CART: CartApi = {
  cart_id: "", customer_id: "", state_version: 0, lines: [], subtotal_minor: 0, currency: "INR",
};

// What each surface knows how to draw. An event naming anything else is dropped
// rather than rendered blank — the stream contract is "render what you know" — and
// the two sets are separate so a merchant card can never appear in the storefront.
const SHOPPING_COMPONENTS: ReadonlySet<ComponentKind> = new Set<ComponentKind>([
  "products", "comparison", "cart", "checkout", "order_status", "guide", "suggestions",
]);
const MERCHANT_COMPONENTS: ReadonlySet<ComponentKind> = new Set<ComponentKind>([
  "digest", "metrics", "change_preview", "suggestions",
]);

function asComponent(
  known: ReadonlySet<ComponentKind>,
  component: string,
  payload: ComponentPayload
): RenderedComponent | null {
  return known.has(component as ComponentKind)
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
  shopperConversationId: string;
  chatHistory: ConversationSummary[];
  startNewShopperChat: () => void;
  selectShopperChat: (conversationId: string) => void;
  cart: CartApi;
  turnActive: boolean;
  progress: string | null;
  stage: StagedCheckout | null;
  checkout: ConfirmedCheckout | null;
  checkoutError: string | null;
  confirmingCheckout: boolean;
  sendShopperMessage: (text: string) => Promise<void>;
  browsingVariantId: string | null;
  setBrowsingVariantId: (id: string | null) => void;
  addToCart: (variantId: string, title: string) => Promise<void>;
  removeFromCart: (variantId: string) => Promise<void>;
  updateQuantity: (variantId: string, quantity: number) => Promise<void>;
  beginCheckout: () => Promise<void>;
  confirmCheckout: (stageId: string) => Promise<void>;
  confirmAndPay: (stageId: string) => Promise<void>;
  cancelStage: () => void;
  retryPayment: (orderId: string) => Promise<void>;
  refreshOrder: (orderId: string) => Promise<OrderApi | undefined>;
  paymentReturned: (orderId: string) => Promise<void>;
  dismissCheckout: () => void;

  // portal
  portalMessages: ChatMessage[];
  merchantConversationId: string;
  portalChatHistory: ConversationSummary[];
  startNewMerchantChat: () => void;
  selectMerchantChat: (conversationId: string) => void;
  portalTurnActive: boolean;
  snapshot: BusinessSnapshot | null;
  changes: MerchantChange[];
  decisionError: string | null;
  sendMerchantMessage: (text: string) => Promise<void>;
  decideChange: (id: string, decision: "approved" | "rejected") => Promise<void>;

  // evidence — this principal's own ledger rows, newest first, scoped to this
  // demo run so a judge sees this session and not every session that ever ran.
  evidence: EvidenceRecord[];
  refreshEvidence: () => Promise<void>;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [shopperId, setShopperId] = useState(() => conversationId("cartisan_shopper"));
  const [merchantId, setMerchantId] = useState(() => conversationId("cartisan_merchant"));
  const [backendError, setBackendError] = useState<string | null>(null);

  const [session, setSession] = useState<Session | null>(null);
  // Which surfaces this session has. The role is authority and the server reads it
  // from the verified token; this copy only decides which requests are worth making,
  // so an operator does not fire three customer-only calls and collect three 403s.
  // Trusting it for anything else would be trusting the client with authority.
  const isShopper = session ? roleFromMetadata(session.user.app_metadata) === "customer" : false;
  const [authReady, setAuthReady] = useState(!supabaseConfigured);

  const [storeMessages, setStoreMessages] = useState<ChatMessage[]>([]);
  const [browsingVariantId, setBrowsingVariantId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ConversationSummary[]>([]);
  const [cart, setCart] = useState<CartApi>(EMPTY_CART);
  const [turnActive, setTurnActive] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [stage, setStage] = useState<StagedCheckout | null>(null);
  const [checkout, setCheckout] = useState<ConfirmedCheckout | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [confirmingCheckout, setConfirmingCheckout] = useState(false);
  const confirmingCheckoutRef = useRef(false);

  const [portalMessages, setPortalMessages] = useState<ChatMessage[]>([]);
  const [portalChatHistory, setPortalChatHistory] = useState<ConversationSummary[]>([]);
  const [portalTurnActive, setPortalTurnActive] = useState(false);
  const [snapshot, setSnapshot] = useState<BusinessSnapshot | null>(null);
  const [changes, setChanges] = useState<MerchantChange[]>([]);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);


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
    setChatHistory([]);
    setPortalMessages([]);
    setPortalChatHistory([]);
    setEvidence([]);
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

  const refreshChatHistory = useCallback(async () => {
    if (!session || !isShopper) {
      setChatHistory([]);
      return;
    }
    const next = await guarded(() => api.storefrontConversations());
    if (next) setChatHistory(next);
  }, [session, isShopper, guarded]);

  const refreshPortalChatHistory = useCallback(async () => {
    if (!session || isShopper) {
      setPortalChatHistory([]);
      return;
    }
    const next = await guarded(() => api.portalConversations());
    if (next) setPortalChatHistory(next);
  }, [session, isShopper, guarded]);

  const refreshEvidence = useCallback(async () => {
    if (!session || !isShopper) return;
    await guarded(async () => {
      // The principal filter is applied by the server from the verified token and is
      // not negotiable. The demo run is NOT applied here: the page offers a "this
      // session only" toggle, and a toggle that cannot widen what was fetched would
      // be a control that lies about what it does.
      setEvidence(await api.myEvidence({ limit: 200 }));
    });
  }, [session, isShopper, guarded]);

  useEffect(() => {
    void refreshChatHistory();
  }, [refreshChatHistory]);

  useEffect(() => {
    void refreshPortalChatHistory();
  }, [refreshPortalChatHistory]);

  const refreshCart = useCallback(async () => {
    if (!session || !isShopper) return;
    await guarded(async () => setCart(await api.cartRead()));
  }, [session, isShopper, guarded]);

  // The cart is re-read whenever the principal changes, so signing in or out
  // never leaves another shopper's cart on screen.
  // Signing out clears the cart explicitly, so this effect only ever loads a cart
  // for a present principal — it never has to blank one out mid-render. An operator
  // has no cart at all, so it does not ask for one.
  useEffect(() => {
    if (!session || !isShopper) return;
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
  }, [session, isShopper]);

  // The conversation itself is server-authoritative too, now that turns are durable.
  // On sign-in the transcript is repainted from the `turns` table, so a reload — or a
  // restart of the backend mid-demo — brings back what was asked and what was
  // answered rather than an empty thread beside an order that plainly exists.
  //
  // Only completed turns carry an agent message worth repainting; a failed or
  // abandoned one is left out rather than shown as if it had answered.
  useEffect(() => {
    if (!session) return;
    let active = true;
    if (!isShopper) return;
    api.resumeStorefront(shopperId)
      .then((resumed) => {
        if (!active || resumed.history.length === 0) return;
        const restored: ChatMessage[] = [];
        for (const turn of resumed.history) {
          if (turn.user_message) {
            restored.push({ id: `${turn.id}-u`, role: "user", text: turn.user_message });
          }
          if (turn.agent_message && turn.state === "completed") {
            restored.push({ id: `${turn.id}-a`, role: "agent", text: turn.agent_message });
          }
        }
        // Never clobber a live conversation: if this tab has already said something,
        // what is on screen is newer than what the server last stored.
        setStoreMessages((current) => (current.length === 0 ? restored : current));
      })
      .catch(() => {
        // A transcript we could not restore is an empty thread, not an error the
        // customer should be shown; everything else on the page still works.
      });
    return () => {
      active = false;
    };
  }, [session, shopperId, isShopper]);

  // The operator transcript is durable for the same reason as the storefront one.
  // Repaint it after reload without mixing it into the customer conversation.
  useEffect(() => {
    if (!session || isShopper) return;
    let active = true;
    api.resumePortal(merchantId)
      .then((resumed) => {
        if (!active || resumed.history.length === 0) return;
        const restored: ChatMessage[] = [];
        for (const turn of resumed.history) {
          if (turn.user_message) {
            restored.push({ id: `${turn.id}-u`, role: "user", text: turn.user_message });
          }
          if (turn.agent_message && turn.state === "completed") {
            restored.push({ id: `${turn.id}-a`, role: "agent", text: turn.agent_message });
          }
        }
        setPortalMessages((current) => (current.length === 0 ? restored : current));
      })
      .catch(() => {
        // The rest of the operator surface remains usable if history is unavailable.
      });
    return () => {
      active = false;
    };
  }, [session, merchantId, isShopper]);

  // The cart and orders are server-authoritative and survive a reload; the staged
  // preview and confirmed-checkout panel are not — they live only in this component's
  // state. Without this, a customer who reloads mid-checkout (or opens the app in a
  // new tab after a decline) loses all sight of an order that is still real, still
  // holding stock, and still retryable: the order itself isn't lost, only the UI's
  // knowledge of it. So on sign-in, resume the most recent order that is neither paid
  // nor terminal, reconstructing a payment handoff from its latest attempt.
  useEffect(() => {
    if (!session || !isShopper) return;
    let active = true;
    api.orders()
      .then((orders) => {
        if (!active) return;
        const open = orders.find(
          (o) => !o.paid && o.status !== "cancelled" && o.status !== "expired" && o.status !== "refunded"
        );
        if (!open) return;
        const latestAttempt = open.attempts[open.attempts.length - 1];
        setCheckout({
          order: open,
          payment: {
            attempt_id: latestAttempt?.attempt_id ?? "",
            status: latestAttempt?.status ?? "created",
            amount_minor: open.total_minor,
            currency: open.currency,
            provider_reference: latestAttempt?.provider_reference ?? null,
            pay_url: latestAttempt?.pay_url ?? null,
          },
        });
      })
      .catch(() => {
        // Silent: a resumable order is a courtesy, not something worth surfacing an
        // error banner for on every sign-in.
      });
    return () => {
      active = false;
    };
  }, [session, isShopper]);

  // The approval queue and the headline snapshot both need an operator principal, so
  // they load once a session exists and are silent when the signed-in user is a
  // shopper — the portal is simply not their surface, which is not an error to show.
  const refreshChanges = useCallback(async () => {
    if (!session || isShopper) return;
    try {
      setChanges(await api.changes());
    } catch {
      /* a shopper gets 403 here; the portal page is what reports that */
    }
  }, [session, isShopper]);

  const refreshSnapshot = useCallback(async () => {
    if (!session || isShopper) return;
    try {
      setSnapshot(await api.portalSnapshot());
    } catch {
      /* as above */
    }
  }, [session, isShopper]);

  useEffect(() => {
    void refreshChanges();
    void refreshSnapshot();
  }, [refreshChanges, refreshSnapshot]);

  useEffect(() => {
    // Evidence is per-principal, so there is nothing to load until someone is
    // signed in — and signing out has to clear what the last principal could see.
    // `/evidence` is the customer's own ledger, so an operator has none to read here;
    // theirs is the store-wide view on the operations page.
    if (!session || !isShopper) {
      setEvidence([]);
      return;
    }
    let active = true;
    api.myEvidence({ limit: 200 })
      .then((next) => {
        if (!active) return;
        setEvidence(next);
        setBackendError(null);
      })
      .catch((error) => {
        if (active) setBackendError(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [session, isShopper]);

  // A checkout with nothing left to do — paid, cancelled, or expired — is a receipt,
  // not something that still needs the customer's attention. Leaving it on screen
  // is a courtesy that stops being one the moment the customer moves to a
  // different conversation; a checkout still holding stock or waiting on Razorpay
  // keeps following them, because that one is still real and still theirs to act on.
  const clearResolvedCheckout = useCallback(() => {
    setCheckout((current) => {
      if (!current) return current;
      const { status, paid } = current.order;
      const resolved = paid || status === "cancelled" || status === "expired";
      return resolved ? null : current;
    });
  }, []);

  const startNewShopperChat = useCallback(() => {
    if (turnActive) return;
    setShopperId(newConversationId("cartisan_shopper"));
    setStoreMessages([]);
    setBackendError(null);
    clearResolvedCheckout();
  }, [turnActive, clearResolvedCheckout]);

  const selectShopperChat = useCallback(
    (conversationIdToSelect: string) => {
      if (
        turnActive ||
        conversationIdToSelect === shopperId ||
        !chatHistory.some((chat) => chat.conversation_id === conversationIdToSelect)
      ) return;
      setShopperId(conversationIdToSelect);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("cartisan_shopper", conversationIdToSelect);
      }
      setStoreMessages([]);
      setBackendError(null);
      clearResolvedCheckout();
    },
    [chatHistory, shopperId, turnActive, clearResolvedCheckout]
  );

  const startNewMerchantChat = useCallback(() => {
    if (portalTurnActive) return;
    setMerchantId(newConversationId("cartisan_merchant"));
    setPortalMessages([]);
    setBackendError(null);
  }, [portalTurnActive]);

  const selectMerchantChat = useCallback(
    (conversationIdToSelect: string) => {
      if (
        portalTurnActive ||
        conversationIdToSelect === merchantId ||
        !portalChatHistory.some((chat) => chat.conversation_id === conversationIdToSelect)
      ) return;
      setMerchantId(conversationIdToSelect);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("cartisan_merchant", conversationIdToSelect);
      }
      setPortalMessages([]);
      setBackendError(null);
    },
    [merchantId, portalChatHistory, portalTurnActive]
  );

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
      // Each customer turn opens a new journey. Everything the turn causes — its
      // tools, a checkout it stages, the order that follows and the provider event
      // that settles it — joins that one lineage, so a judge follows a purchase
      // rather than an afternoon of browsing (ADR 0032).
      api.beginJourney();
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
        for await (const event of api.chatStorefront(shopperId, trimmed, browsingVariantId)) {
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
              const component = asComponent(
                SHOPPING_COMPONENTS, event.data.component, event.data.payload
              );
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
      await refreshEvidence();
      await refreshChatHistory();
    },
    [shopperId, session, turnActive, browsingVariantId, refreshCart, refreshEvidence, refreshChatHistory]
  );

  const addToCart = useCallback(
    async (variantId: string, title: string) => {
      if (!session) return;
      const updated = await guarded(() =>
        api.cartAdd(variantId, 1, `Customer added "${title}"`, cart.state_version)
      );
      if (updated) setCart(updated);
      refreshEvidence();
    },
    [session, cart.state_version, guarded, refreshEvidence]
  );

  const removeFromCart = useCallback(
    async (variantId: string) => {
      if (!session) return;
      const updated = await guarded(() => api.cartRemove(variantId));
      if (updated) setCart(updated);
      refreshEvidence();
    },
    [session, guarded, refreshEvidence]
  );

  const updateQuantity = useCallback(
    async (variantId: string, quantity: number) => {
      if (!session) return;
      const updated = await guarded(() =>
        api.cartUpdate(variantId, quantity, "Customer changed the quantity", cart.state_version)
      );
      if (updated) setCart(updated);
      refreshEvidence();
    },
    [session, cart.state_version, guarded, refreshEvidence]
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
    refreshEvidence();
  }, [session, cart.lines.length, refreshEvidence]);

  /**
   * The customer's confirmation. This is what creates the order and reserves the
   * stock, and it is deliberately a separate, explicit act from staging (ADR 0012).
   */
  const confirmCheckout = useCallback(
    async (stageId: string) => {
      // Guards a fast double click: the second call would otherwise race the
      // first to the same stage and lose with a stale "no longer open" error.
      if (!session || confirmingCheckoutRef.current) return;
      confirmingCheckoutRef.current = true;
      setConfirmingCheckout(true);
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
      } finally {
        confirmingCheckoutRef.current = false;
        setConfirmingCheckout(false);
      }
      refreshEvidence();
    },
    [session, refreshCart, refreshEvidence]
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
      refreshEvidence();
    },
    [session, refreshEvidence]
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

  /**
   * One tap that does both the customer's confirm (ADR 0012) and the Razorpay
   * handoff: confirm still runs first and still creates the order and reserves
   * stock, this just opens the resulting pay_url immediately instead of making
   * the customer read a second screen and click again.
   */
  const confirmAndPay = useCallback(
    async (stageId: string) => {
      if (!session || confirmingCheckoutRef.current) return;
      confirmingCheckoutRef.current = true;
      setConfirmingCheckout(true);
      setCheckoutError(null);
      try {
        const confirmed = await api.confirmCheckout(stageId);
        setCheckout(confirmed);
        setStage(null);
        setCart((current) => ({ ...current, lines: [], subtotal_minor: 0 }));
        await refreshCart();
        setBackendError(null);
        if (confirmed.payment.pay_url) {
          window.open(confirmed.payment.pay_url, "_blank", "noopener,noreferrer");
          await paymentReturned(confirmed.order.order_id);
        }
      } catch (e) {
        setCheckoutError(errorMessage(e));
        await refreshCart();
      } finally {
        confirmingCheckoutRef.current = false;
        setConfirmingCheckout(false);
      }
      refreshEvidence();
    },
    [session, refreshCart, refreshEvidence, paymentReturned]
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
      refreshEvidence();
      return order;
    },
    [session, guarded, refreshEvidence]
  );

  /**
   * Run one merchant turn, rendering its event stream as it arrives.
   *
   * The same loop the storefront runs, over the same event types — the portal used to
   * wait for one `message` frame carrying a finished reply. The one merchant-specific
   * event is `change_update`: the agent staged something, and the approval queue is a
   * different pane, so it is told directly rather than polled for.
   */
  const sendMerchantMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !session || portalTurnActive) return;
      setPortalMessages((s) => [...s, { id: uid("m"), role: "user", text: trimmed }]);

      const replyId = uid("m");
      setPortalMessages((s) => [...s, { id: replyId, role: "agent", text: "", typing: true }]);
      setPortalTurnActive(true);
      setProgress(null);

      const patch = (update: (m: ChatMessage) => ChatMessage) =>
        setPortalMessages((s) => s.map((m) => (m.id === replyId ? update(m) : m)));

      let brokeForTool = false;
      let staged = false;

      try {
        for await (const event of api.chatPortal(merchantId, trimmed)) {
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
              const component = asComponent(
                MERCHANT_COMPONENTS, event.data.component, event.data.payload
              );
              if (component) {
                patch((m) => ({
                  ...m,
                  typing: false,
                  components: [...(m.components ?? []), component],
                }));
              }
              break;
            }

            case "change_update":
              // A staged change, straight into the queue. It is `pending` and nothing
              // else: the agent cannot produce any other status (ADR 0016).
              staged = true;
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

            default:
              break;
          }
        }
        setBackendError(null);
      } catch (e) {
        patch((m) => ({ ...m, typing: false, error: errorMessage(e) }));
        setBackendError(errorMessage(e));
      } finally {
        setPortalTurnActive(false);
        setProgress(null);
      }

      // Re-read rather than trust the event's copy: the queue shows the rows as the
      // database holds them, which is what the operator is deciding on.
      if (staged) await refreshChanges();
      await refreshSnapshot();
      await refreshEvidence();
      await refreshPortalChatHistory();
    },
    [
      merchantId,
      session,
      portalTurnActive,
      refreshChanges,
      refreshSnapshot,
      refreshEvidence,
      refreshPortalChatHistory,
    ]
  );

  /**
   * The operator's decision, and — on an approval — the application that follows it.
   *
   * A 409 here is the system working: the server re-read the record and refused to
   * write, because the change went stale or a bound no longer holds. The reason is
   * shown rather than swallowed, because it tells the operator what to do next.
   */
  const decideChange = useCallback(
    async (id: string, decision: "approved" | "rejected") => {
      if (!session) return;
      setDecisionError(null);
      try {
        const updated = await api.decideChange(id, decision);
        setChanges((s) => s.map((c) => (c.id === id ? updated : c)));
        setBackendError(null);
      } catch (e) {
        setDecisionError(errorMessage(e));
        // The change was marked failed server-side, so the queue is re-read to show
        // that rather than leaving a row that still looks pending.
        await refreshChanges();
      }
      await refreshSnapshot();
      refreshEvidence();
    },
    [session, refreshChanges, refreshSnapshot, refreshEvidence]
  );

  const value: AppState = {
    backendError,
    session,
    authReady,
    authConfigured: supabaseConfigured,
    signIn,
    signOut,
    storeMessages,
    shopperConversationId: shopperId,
    chatHistory,
    startNewShopperChat,
    selectShopperChat,
    cart,
    turnActive,
    progress,
    stage,
    checkout,
    checkoutError,
    confirmingCheckout,
    sendShopperMessage,
    browsingVariantId,
    setBrowsingVariantId,
    addToCart,
    removeFromCart,
    updateQuantity,
    beginCheckout,
    confirmCheckout,
    confirmAndPay,
    cancelStage,
    retryPayment,
    refreshOrder,
    paymentReturned,
    dismissCheckout,
    portalMessages,
    merchantConversationId: merchantId,
    portalChatHistory,
    startNewMerchantChat,
    selectMerchantChat,
    portalTurnActive,
    snapshot,
    changes,
    decisionError,
    sendMerchantMessage,
    decideChange,
    evidence,
    refreshEvidence,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
