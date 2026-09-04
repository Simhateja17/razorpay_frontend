"use client";

import { useState } from "react";
import MessageList from "@/components/storefront/MessageList";
import type { ChatMessage } from "@/lib/types";

const initialMessages: ChatMessage[] = Array.from({ length: 12 }, (_, index) => ({
  id: `seed-${index}`,
  role: "agent",
  text: `Seed message ${index + 1}`,
}));

export default function ScrollTestPage() {
  const [messages, setMessages] = useState(initialMessages);

  return (
    <main className="p-6 bg-bg">
      <div data-testid="chat-scroll" className="h-[240px] overflow-y-auto bg-white border border-border p-4">
        <MessageList messages={messages} />
        <button
          data-testid="add-message"
          onClick={() =>
            setMessages((current) => [
              ...current,
              { id: `message-${current.length}`, role: "agent", text: "New streamed message" },
            ])
          }
        >
          Add message
        </button>
      </div>
    </main>
  );
}
