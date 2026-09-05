"use client";
import { useState } from "react";
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

export default function StorefrontPage() {
  const { storeMessages, sendShopperMessage, turnActive, progress, shopperConversationId,
    chatHistory, startNewShopperChat, selectShopperChat, browsingVariantId, setBrowsingVariantId,
    cart, stage, checkout } = useAppState();
  const [chatOpen, setChatOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const scrollRef = useAutoScroll(storeMessages);
  const expanded = chatOpen || !!stage || !!checkout;
  const ask = (text: string) => { setChatOpen(true); void sendShopperMessage(text); };
  return <RoleGate role="customer">
    <div className="h-full flex min-w-0 relative">
      <main className="flex-1 min-w-0 flex flex-col bg-bg">
        <div className="flex-none flex justify-end px-4 py-2 border-b border-border-soft"><button className="text-sm" onClick={() => setCartOpen(!cartOpen)} aria-expanded={cartOpen}>Your cart ({cart.lines.reduce((n, l) => n + l.quantity, 0)}) {cartOpen ? "−" : "+"}</button></div>
        <div className="flex-1 min-h-0 overflow-y-auto"><CatalogBrowser onAsk={ask} /></div>
        <section aria-label="Shopping assistant" className="flex-none border-t border-border bg-white shadow-[0_-4px_24px_#00000008]">
          <div className="px-4 py-2 flex items-center justify-between gap-2">
            <button onClick={() => setChatOpen(!chatOpen)} aria-expanded={expanded} aria-controls="shopping-transcript" className="text-sm font-semibold">✦ Shopping assistant {expanded ? "⌄" : "⌃"}</button>
            <ConversationSwitcher conversations={chatHistory} activeConversationId={shopperConversationId} turnActive={turnActive} onNewChat={() => { startNewShopperChat(); setChatOpen(true); }} onSelectChat={id => { selectShopperChat(id); setChatOpen(true); }} />
          </div>
          {browsingVariantId && <div className="px-4 pb-2 text-xs text-accent flex gap-3"><span>Asking about the selected product</span><button onClick={() => setBrowsingVariantId(null)} className="underline">Clear</button></div>}
          {expanded && <div id="shopping-transcript" ref={scrollRef} className="h-[38dvh] overflow-y-auto px-4 pb-3"><div className="max-w-[720px] mx-auto">
            {!storeMessages.length && <p className="text-sm text-ink-muted py-4">Ask for recommendations, compare products, or tell me what you need. Your conversation stays here as you browse.</p>}
            <MessageList messages={storeMessages} /><StagePanel /><PaymentPanel />
            {progress && <p role="status" className="text-xs text-ink-muted">{progress}</p>}
          </div></div>}
          <ChatInput onSend={ask} placeholder={turnActive ? "Working…" : browsingVariantId ? "Ask about this product or find an alternative…" : "Ask anything about the collection…"} busy={turnActive} />
        </section>
      </main>
      {cartOpen && <div className="absolute inset-y-0 right-0 z-20 flex max-w-full shadow-xl lg:static lg:shadow-none"><button aria-label="Close cart" className="absolute right-2 top-12 z-10 rounded bg-white border px-2" onClick={() => setCartOpen(false)}>×</button><CartSidebar /></div>}
    </div>
  </RoleGate>;
}
