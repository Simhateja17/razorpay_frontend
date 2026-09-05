"use client";
import { useEffect, useState } from "react";
import { useAppState } from "@/lib/store/AppState";
import { useAutoScroll } from "@/lib/useAutoScroll";
import MessageList from "@/components/storefront/MessageList";
import ChatInput from "@/components/storefront/ChatInput";
import CartSidebar from "@/components/storefront/CartSidebar";
import StagePanel from "@/components/storefront/StagePanel";
import PaymentPanel from "@/components/storefront/PaymentPanel";
import ConversationSwitcher from "@/components/storefront/ConversationSwitcher";
import CatalogBrowser from "@/components/storefront/CatalogBrowser";
import RoleGate from "@/components/shared/RoleGate";

/** Typed out one at a time in the idle search bar, so the bar advertises what the assistant can do. */
const EXAMPLES = [
  "Find me a good pair of headphones under ₹5,000",
  "Compare the two air purifiers",
  "What charger works with my laptop?",
  "Show me something cheaper than this",
];

/** Offered above the bar before the first message — the same openers the old panel showed. */
const OPENERS = [
  "What's popular right now?",
  "Help me choose a gift under ₹3,000",
  "Compare the top two headphones",
];

export default function StorefrontPage() {
  const { storeMessages, sendShopperMessage, turnActive, progress, shopperConversationId,
    chatHistory, startNewShopperChat, selectShopperChat, browsingVariantId, setBrowsingVariantId,
    cart, stage, checkout, lastCartAddAt } = useAppState();
  const [chatOpen, setChatOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [recoveryDetailsOpen, setRecoveryDetailsOpen] = useState(false);
  const scrollRef = useAutoScroll(storeMessages);

  // Adding a line slides the cart in — the confirmation that the add landed. It is
  // driven by the explicit-add signal, so browsing or an agent turn never opens it.
  useEffect(() => {
    if (!lastCartAddAt) return;
    const frame = requestAnimationFrame(() => setCartOpen(true));
    return () => cancelAnimationFrame(frame);
  }, [lastCartAddAt]);

  // A staged checkout or a live payment is the assistant talking — surface it even if the
  // shopper never opened the panel themselves.
  useEffect(() => {
    if (!stage && !checkout) return;
    const frame = requestAnimationFrame(() => setChatOpen(true));
    return () => cancelAnimationFrame(frame);
  }, [stage, checkout]);

  // Escape closes the conversation without losing it; reopening shows the same transcript.
  useEffect(() => {
    if (!chatOpen && !cartOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (cartOpen) setCartOpen(false);
      else setChatOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatOpen, cartOpen]);

  const ask = (text: string) => { setChatOpen(true); void sendShopperMessage(text); };
  const cartCount = cart.lines.reduce((n, l) => n + l.quantity, 0);
  const openOrder = checkout && !checkout.order.paid && !["cancelled", "expired", "refunded"].includes(checkout.order.status)
    ? checkout.order : null;
  const lastAttempt = openOrder?.attempts[openOrder.attempts.length - 1];
  const recoveryTitle = lastAttempt?.status === "failed"
    ? "Payment didn’t go through"
    : openOrder?.status === "payment_verification_pending"
      ? "We’re verifying your payment"
      : "Your order is waiting for you";
  const showRecovery = () => {
    setChatOpen(true);
    const visibleCheckout = document.getElementById("active-checkout");
    if (visibleCheckout) {
      visibleCheckout.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setRecoveryDetailsOpen(true);
    requestAnimationFrame(() => document.getElementById("active-checkout")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };
  const startFreshChat = () => {
    setRecoveryDetailsOpen(false);
    startNewShopperChat();
  };
  const selectChat = (conversationId: string) => {
    setRecoveryDetailsOpen(false);
    selectShopperChat(conversationId);
  };

  return <RoleGate role="customer">
    <div className="h-full flex min-w-0 relative">
      <main className="flex-1 min-w-0 flex flex-col bg-bg relative">
        <div className="flex-none flex justify-end px-4 py-2 border-b border-border-soft">
          <button className="text-sm" onClick={() => setCartOpen(!cartOpen)} aria-expanded={cartOpen}>Your cart ({cartCount}) {cartOpen ? "−" : "+"}</button>
        </div>

        {/* The catalog owns the page. The assistant is a bar at the bottom until it is asked for. */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <CatalogBrowser onAsk={ask} />
          <div className="h-40" aria-hidden="true" />
        </div>

        {!chatOpen && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pb-5 pt-10" style={{ background: "linear-gradient(to top, var(--bg) 55%, transparent)" }}>
            <div className="pointer-events-auto max-w-[720px] mx-auto flex flex-col gap-2.5">
              {browsingVariantId && (
                <div className="flex items-center gap-3 text-xs text-accent">
                  <span>Asking about the selected product</span>
                  <button onClick={() => setBrowsingVariantId(null)} className="underline">Clear</button>
                </div>
              )}
              {storeMessages.length === 0 ? (
                <div className="flex flex-wrap gap-2">
                  {OPENERS.map(text => (
                    <button key={text} onClick={() => ask(text)} disabled={turnActive}
                      className="bg-white/90 backdrop-blur border border-border rounded-full px-3 py-1.5 text-[12.5px] text-ink-muted hover:border-accent hover:text-accent disabled:opacity-50 transition-colors">
                      {text}
                    </button>
                  ))}
                </div>
              ) : (
                <button onClick={() => setChatOpen(true)}
                  className="self-start bg-white/90 backdrop-blur border border-border rounded-full px-3 py-1.5 text-[12.5px] text-ink-muted hover:border-accent hover:text-accent transition-colors">
                  ✦ Continue your conversation ({storeMessages.length})
                </button>
              )}
              <SearchBar onSend={ask} busy={turnActive} browsing={!!browsingVariantId} />
            </div>
          </div>
        )}
      </main>

      {/* Asking opens the assistant properly: full transcript, its own cards, its own composer. */}
      {chatOpen && (
        <div role="dialog" aria-modal="true" aria-label="Shopping assistant" className="absolute inset-0 z-30 flex flex-col bg-bg">
          <div className="flex-none flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-white">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm font-semibold whitespace-nowrap">✦ Shopping assistant</span>
              {openOrder && (
                <button onClick={showRecovery} className="group min-w-0 flex items-center gap-2 rounded-full border border-upsell-border bg-upsell-bg px-3 py-1.5 text-left hover:border-accent transition-colors">
                  <span aria-hidden="true" className={`h-2 w-2 flex-none rounded-full ${lastAttempt?.status === "failed" ? "bg-danger" : "bg-upsell-ink animate-pulse"}`} />
                  <span className="min-w-0">
                    <span className="block truncate text-[11.5px] font-semibold text-ink">{recoveryTitle}</span>
                    <span className="block truncate text-[10px] text-ink-muted">{openOrder.order_id} · {openOrder.lines.length} {openOrder.lines.length === 1 ? "item" : "items"} · {lastAttempt?.status === "failed" ? "Retry the same order" : "Finish when you’re ready"}</span>
                  </span>
                  <span aria-hidden="true" className="text-accent text-xs group-hover:translate-x-0.5 transition-transform">→</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ConversationSwitcher conversations={chatHistory} activeConversationId={shopperConversationId} turnActive={turnActive}
                onNewChat={startFreshChat} onSelectChat={selectChat} />
              <button onClick={() => setChatOpen(false)} aria-label="Close assistant"
                className="border border-border rounded-md px-2.5 py-1.5 text-[12px] text-ink-muted hover:border-accent hover:text-accent transition-colors">
                Back to browsing
              </button>
            </div>
          </div>

          {browsingVariantId && (
            <div className="flex-none px-4 py-2 text-xs text-accent flex gap-3 border-b border-border-soft bg-white">
              <span>Asking about the selected product</span>
              <button onClick={() => setBrowsingVariantId(null)} className="underline">Clear</button>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-5">
            <div className="max-w-[720px] mx-auto">
              {!storeMessages.length && <p className="text-sm text-ink-muted py-4">Ask for recommendations, compare products, or tell me what you need. Your conversation stays here as you browse.</p>}
              <MessageList messages={storeMessages} /><StagePanel />
              {recoveryDetailsOpen && <PaymentPanel />}
              {progress && <p role="status" className="text-xs text-ink-muted mt-2">{progress}</p>}
            </div>
          </div>

          <ChatInput onSend={ask} examples={EXAMPLES}
            placeholder={turnActive ? "Working…" : browsingVariantId ? "Ask about this product or find an alternative…" : "Ask anything about the collection…"}
            busy={turnActive} />
        </div>
      )}

      {/* Always a drawer over the page — the same panel the shopper sees slide in on an add. */}
      {cartOpen && (
        <div className="slide-in-right absolute inset-y-0 right-0 z-40 flex max-w-full shadow-[-8px_0_28px_#00000014]">
          <button aria-label="Close cart" onClick={() => setCartOpen(false)}
            className="absolute right-3 top-3 z-10 rounded-md border border-border bg-white px-2 py-0.5 text-ink-muted hover:text-ink">×</button>
          <CartSidebar />
        </div>
      )}
    </div>
  </RoleGate>;
}

/**
 * The resting state of the assistant: one search bar, sitting under the catalog.
 * Submitting is what opens the conversation — nothing else on the page moves until then.
 */
function SearchBar({ onSend, busy, browsing }: { onSend: (text: string) => void; busy: boolean; browsing: boolean }) {
  const [draft, setDraft] = useState("");
  const submit = () => { if (!draft.trim()) return; onSend(draft); setDraft(""); };
  return (
    <div className="flex gap-2 items-center bg-white border border-border rounded-2xl px-4 py-2.5 shadow-[0_8px_28px_#0000000f]">
      <span aria-hidden="true" className="text-accent text-[15px]">✦</span>
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); }}
        placeholder={browsing ? "Ask about this product or find an alternative…" : "Ask your shopping assistant anything…"}
        aria-label="Ask your shopping assistant"
        className="flex-1 min-w-0 border-none outline-none bg-transparent text-[14.5px] py-1.5"
      />
      <button onClick={submit} disabled={busy} aria-label="Ask the assistant"
        className="flex-none bg-accent text-white rounded-xl w-[34px] h-[34px] flex items-center justify-center text-[15px] hover:bg-accent-hover disabled:opacity-50 transition-colors">
        ↑
      </button>
    </div>
  );
}
