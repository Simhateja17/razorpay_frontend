"use client";

import { ChatMessage } from "@/lib/types";
import ProductCardView from "./ProductCardView";
import CheckoutCard from "./CheckoutCard";

export default function MessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="flex flex-col gap-6">
      {messages.map((m) => (
        <div key={m.id} className="rise-in flex flex-col gap-3">
          {m.role === "user" && (
            <div className="self-end max-w-[78%] bg-ink text-bg px-4 py-2.5 rounded-2xl rounded-br-md text-[14.5px] leading-relaxed">
              {m.text}
            </div>
          )}

          {m.role === "agent" && (
            <div className="flex gap-2.5 items-start">
              <div className="flex-none w-[26px] h-[26px] rounded-md bg-accent text-white flex items-center justify-center font-mono text-[11px] mt-0.5">
                C
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="text-[14.5px] leading-relaxed text-ink">{m.text}</div>
                {m.why && (
                  <div className="flex gap-2 items-start bg-white border border-border-soft rounded-lg px-2.5 py-2">
                    <span className="font-mono text-[9.5px] text-ink-faint tracking-wide flex-none mt-0.5">WHY</span>
                    <span className="text-[12.5px] text-[#5d5d58] leading-relaxed">{m.why}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {m.products && m.products.length > 0 && (
            <div className="grid gap-3 ml-9" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(196px, 1fr))" }}>
              {m.products.map((p) => (
                <ProductCardView key={p.id} product={p} />
              ))}
            </div>
          )}

          {m.checkout && <CheckoutCard msgId={m.id} checkout={m.checkout} status={m.orderStatus} />}
        </div>
      ))}
    </div>
  );
}
