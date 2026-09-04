"use client";

import { useState } from "react";
import type { ConversationSummary } from "@/lib/types";

function dateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function titleLabel(chat: ConversationSummary): string {
  return chat.title?.trim() || "Untitled chat";
}

export default function ConversationSwitcher({
  conversations,
  activeConversationId,
  turnActive,
  onNewChat,
  onSelectChat,
}: {
  conversations: ConversationSummary[];
  activeConversationId: string;
  turnActive: boolean;
  onNewChat: () => void;
  onSelectChat: (conversationId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const startNewChat = () => {
    setOpen(false);
    onNewChat();
  };

  const selectChat = (conversationId: string) => {
    setOpen(false);
    onSelectChat(conversationId);
  };

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={startNewChat}
        disabled={turnActive}
        className="border border-border rounded-md px-2.5 py-1.5 text-[12px] text-ink-muted hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        + New chat
      </button>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="border border-border rounded-md px-2.5 py-1.5 text-[12px] text-ink-muted hover:border-accent hover:text-accent transition-colors"
      >
        Chat history{conversations.length > 0 ? ` (${conversations.length})` : ""}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Chat history"
          className="absolute right-0 top-[calc(100%+8px)] z-20 w-[300px] bg-white border border-border rounded-xl shadow-lg p-2"
        >
          <div className="px-2 py-1.5 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-ink">Your chats</span>
            <span className="font-mono text-[10px] text-ink-faint">{conversations.length}</span>
          </div>
          {conversations.length === 0 ? (
            <p className="m-0 px-2 py-4 text-[12px] text-ink-faint">
              No previous chats yet.
            </p>
          ) : (
            <div className="max-h-[300px] overflow-y-auto flex flex-col gap-0.5">
              {conversations.map((chat) => {
                const active = chat.conversation_id === activeConversationId;
                return (
                  <button
                    type="button"
                    key={chat.conversation_id}
                    onClick={() => selectChat(chat.conversation_id)}
                    disabled={turnActive}
                    aria-current={active ? "page" : undefined}
                    className={`w-full text-left rounded-lg px-2.5 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      active ? "bg-surface-muted" : "hover:bg-surface-muted"
                    }`}
                  >
                    <span className="block truncate text-[12.5px] text-ink">
                      {titleLabel(chat)}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-ink-faint">
                      <span>{chat.turn_count} {chat.turn_count === 1 ? "turn" : "turns"}</span>
                      {dateLabel(chat.updated_at) && <span>· {dateLabel(chat.updated_at)}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
