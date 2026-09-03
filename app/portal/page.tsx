"use client";

import { useAppState } from "@/lib/store/AppState";
import MessageList from "@/components/storefront/MessageList";
import ChatInput from "@/components/storefront/ChatInput";
import KpiStrip from "@/components/portal/KpiStrip";
import ApprovalQueue from "@/components/portal/ApprovalQueue";

const SUGGESTED_PROMPTS = [
  "How are sales looking this week?",
  "Anything I should worry about in inventory?",
  "What would you change about Fashion pricing?",
];

export default function PortalPage() {
  const { portalMessages, sendMerchantMessage, snapshot } = useAppState();
  const empty = portalMessages.length === 0;

  return (
    <div className="h-full flex flex-col">
      <KpiStrip snapshot={snapshot} />
      <div className="flex-1 min-h-0 flex">
        <main className="flex-1 min-w-0 flex flex-col bg-bg">
          <div className="flex-1 overflow-y-auto px-6 pt-7 pb-2">
            <div className="max-w-[720px] mx-auto flex flex-col gap-6">
              {empty && (
                <div className="pt-6 pb-2 flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="w-[34px] h-[34px] rounded-[9px] bg-accent text-white flex items-center justify-center text-[15px] font-semibold">
                      C
                    </div>
                    <h1 className="mt-2 text-[24px] font-semibold tracking-tight">How can I help run the store?</h1>
                    <p className="m-0 text-[14px] text-ink-muted max-w-[52ch] leading-relaxed">
                      Ask about sales, inventory, or pricing. Anything I&apos;d change goes into the approval queue on the right - nothing applies until you approve it.
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
              <MessageList messages={portalMessages} />
            </div>
          </div>
          <ChatInput onSend={sendMerchantMessage} placeholder="Ask about sales, inventory, pricing…" />
        </main>
        <ApprovalQueue />
      </div>
    </div>
  );
}
