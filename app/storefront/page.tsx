"use client";

import { useAppState } from "@/lib/store/AppState";
import { useAutoScroll } from "@/lib/useAutoScroll";
import MessageList from "@/components/storefront/MessageList";
import ChatInput from "@/components/storefront/ChatInput";
import CartSidebar from "@/components/storefront/CartSidebar";
import StagePanel from "@/components/storefront/StagePanel";
import PaymentPanel from "@/components/storefront/PaymentPanel";
import ConversationSwitcher from "@/components/storefront/ConversationSwitcher";
import RoleGate from "@/components/shared/RoleGate";

const SUGGESTED_PROMPTS = [
  "I need a laptop and a charger that can actually drive it",
  "Compare the chargers you have under ₹3,000",
  "What's in my cart?",
];

// One example per thing the shopping agent can actually do — search, compare, cart,
// preferences, orders, policies, shipping, checkout — cycled in the input as a live
// demonstration of scope, not just a static hint.
const CAPABILITY_EXAMPLES = [
  "Find me a laptop under ₹60,000",
  "Compare the chargers you have under ₹3,000",
  "Tell me more about the Noise Buds",
  "Add 2 of the wireless mouse to my cart",
  "What's in my cart?",
  "Remove the charger from my cart",
  "Remember I prefer wired earphones over wireless",
  "Where's my last order?",
  "Show my order history",
  "What's your return policy?",
  "How fast can this ship to Mumbai?",
  "Help me pick a laptop for video editing",
  "Checkout with my saved card",
  "What can you help me with?",
];

export default function StorefrontPage() {
  const {
    storeMessages,
    sendShopperMessage,
    turnActive,
    progress,
    shopperConversationId,
    chatHistory,
    startNewShopperChat,
    selectShopperChat,
  } = useAppState();
  const empty = storeMessages.length === 0;
  const scrollRef = useAutoScroll(storeMessages);

  return (
    <RoleGate role="customer">
    <div className="h-full flex">
      <main className="flex-1 min-w-0 flex flex-col bg-bg">
        <div className="flex-none px-6 pt-3">
          <div className="max-w-[720px] mx-auto flex items-center justify-end">
            <ConversationSwitcher
              conversations={chatHistory}
              activeConversationId={shopperConversationId}
              turnActive={turnActive}
              onNewChat={startNewShopperChat}
              onSelectChat={selectShopperChat}
            />
          </div>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pt-7 pb-2">
          <div className="max-w-[720px] mx-auto flex flex-col gap-6">
            {empty && (
              <div className="pt-11 pb-2 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="w-[34px] h-[34px] rounded-[9px] bg-accent text-white flex items-center justify-center text-[15px] font-semibold">
                    C
                  </div>
                  <h1 className="mt-2 text-[27px] font-semibold tracking-tight">What are you shopping for?</h1>
                  <p className="m-0 text-[14.5px] text-ink-muted max-w-[46ch] leading-relaxed">
                    Tell the shopping agent in plain words. It searches the marketplace, builds your cart, and hands you off to Razorpay to pay. Every action it takes is logged in the audit trail.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {SUGGESTED_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => sendShopperMessage(p)}
                      className="bg-white border border-border rounded-full px-3.5 py-2 text-[13.5px] text-ink hover:border-accent hover:text-accent transition-colors text-left"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <MessageList messages={storeMessages} />
            {/* The staged preview and the payment handoff live below the transcript
                rather than inside a message: they are the current state of one
                checkout, not something the agent said at a moment in time. */}
            <StagePanel />
            <PaymentPanel />
            {progress && (
              <span className="ml-9 text-[12px] text-ink-faint font-mono" aria-live="polite">
                {progress}
              </span>
            )}
          </div>
        </div>
        <ChatInput
          onSend={sendShopperMessage}
          placeholder={turnActive ? "Working…" : "Ask the shopping agent…"}
          examples={CAPABILITY_EXAMPLES}
          busy={turnActive}
        />
      </main>
      <CartSidebar />
    </div>
    </RoleGate>
  );
}
