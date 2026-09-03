"use client";

import { useState, KeyboardEvent } from "react";

export default function ChatInput({
  onSend,
  placeholder,
}: {
  onSend: (text: string) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  const submit = () => {
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") submit();
  };

  return (
    <div className="flex-none px-6 pb-5 pt-3" style={{ background: "linear-gradient(to top, var(--bg) 62%, transparent)" }}>
      <div className="max-w-[720px] mx-auto flex gap-2 items-end bg-white border border-border rounded-xl px-3.5 py-2 shadow-sm">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          className="flex-1 min-w-0 border-none outline-none bg-transparent text-[14.5px] py-1.5"
        />
        <button
          onClick={submit}
          aria-label="Send message"
          className="flex-none bg-accent text-white rounded-lg w-[34px] h-[34px] flex items-center justify-center text-[15px] hover:bg-accent-hover transition-colors"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
