"use client";

import { useAppState } from "@/lib/store/AppState";
import { useAutoScroll } from "@/lib/useAutoScroll";
import MessageList from "@/components/storefront/MessageList";
import ChatInput from "@/components/storefront/ChatInput";
import KpiStrip from "@/components/portal/KpiStrip";
import ApprovalQueue from "@/components/portal/ApprovalQueue";
import MerchantComponent from "@/components/portal/MerchantComponent";
import ConversationSwitcher from "@/components/storefront/ConversationSwitcher";
import RoleGate from "@/components/shared/RoleGate";

// Openers that match what the merchant surface can actually do: read the store's own
// records, and queue a change for approval. "Fashion pricing" was a legacy catalogue.
const SUGGESTED_PROMPTS = [
  "How are sales looking this week?",
  "Anything I should restock?",
  "How is the Monsoon Audio Push campaign doing?",
];

// One example per thing the merchant agent can actually do — reading the snapshot,
// metrics, campaigns, listings, inventory, and order health, and staging (never
// applying) a price, restock, promotion, or campaign change — cycled in the input
// as a live demonstration of scope. Every listing, category, and campaign named
// here is real, checked against backend/marketplace_backend/seed/domain.py
// (categories at lines 49-59, product lines at 70-330, campaigns at 370-375 —
// "Monsoon Audio Push", "Smart Home Diwali", "Always-On Brand"); the catalog does
// not include a "Noise Buds" listing or anything by that name.
const CAPABILITY_EXAMPLES = [
  "How are sales looking this week?",
  "What's our revenue by category this month?",
  "How is the Monsoon Audio Push campaign doing?",
  "Show me our top-selling audio listings",
  "Show me the listing for the Wireless Earbuds",
  "Anything I should restock?",
  "Any order issues I should know about?",
  "What's the pricing headroom on this listing?",
  "What changes are pending approval?",
  "Fix the title and description on this listing",
  "Drop the price on the Wireless Mouse to ₹1,999",
  "Restock the Fast Charger by 50 units",
  "Run a 15% off promotion on Personal Audio this weekend",
  "Start a campaign for the Smart Home listings",
  "What can you help me with?",
];

export default function PortalPage() {
  const {
    portalMessages,
    sendMerchantMessage,
    snapshot,
    merchantConversationId,
    portalChatHistory,
    startNewMerchantChat,
    selectMerchantChat,
    portalTurnActive,
  } = useAppState();
  const empty = portalMessages.length === 0;
  const scrollRef = useAutoScroll(portalMessages);

  return (
    <RoleGate role="merchant_operator">
    <div className="h-full flex flex-col">
      <KpiStrip snapshot={snapshot} />
      <div className="flex-1 min-h-0 flex">
        <main className="flex-1 min-w-0 flex flex-col bg-bg">
          <div className="flex-none px-6 pt-3">
            <div className="max-w-[720px] mx-auto flex items-center justify-end">
              <ConversationSwitcher
                conversations={portalChatHistory}
                activeConversationId={merchantConversationId}
                turnActive={portalTurnActive}
                onNewChat={startNewMerchantChat}
                onSelectChat={selectMerchantChat}
              />
            </div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pt-7 pb-2">
            <div className="max-w-[720px] mx-auto flex flex-col gap-6">
              {empty && (
                <div className="pt-6 pb-2 flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="w-[34px] h-[34px] rounded-[9px] bg-accent text-white flex items-center justify-center text-[15px] font-semibold">
                      C
                    </div>
                    <h1 className="mt-2 text-[24px] font-semibold tracking-tight">How can I help run the store?</h1>
                    <p className="m-0 text-[14px] text-ink-muted max-w-[52ch] leading-relaxed">
                      Ask about sales, inventory, or pricing. I read the store&apos;s own records and show the formula behind every figure. Anything I&apos;d change is queued on the right — I can propose it and nothing more; it applies only when you approve it.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {SUGGESTED_PROMPTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => sendMerchantMessage(p)}
                        className="bg-white border border-border rounded-full px-3.5 py-2 text-[13.5px] text-ink hover:border-accent hover:text-accent transition-colors text-left"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <MessageList messages={portalMessages} renderComponent={MerchantComponent} />
            </div>
          </div>
          <ChatInput
            onSend={sendMerchantMessage}
            placeholder="Ask about sales, inventory, pricing…"
            examples={CAPABILITY_EXAMPLES}
            busy={portalTurnActive}
          />
        </main>
        <ApprovalQueue />
      </div>
    </div>
    </RoleGate>
  );
}
