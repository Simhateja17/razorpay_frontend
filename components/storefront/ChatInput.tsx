"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";

const TYPE_MS = 32;
const ERASE_MS = 16;
const HOLD_MS = 1500;
const GAP_MS = 400;

/**
 * Types each example out letter by letter, holds it, erases it, and moves to the
 * next — cycling for as long as `enabled` (the field is idle and empty). Runs on
 * the native `placeholder` string itself rather than an overlay, so it always
 * inherits the input's real `::placeholder` styling and never fights focus/caret
 * behavior.
 */
function useTypewriterPlaceholder(examples: string[], enabled: boolean) {
  const [text, setText] = useState("");
  const examplesRef = useRef(examples);
  useEffect(() => { examplesRef.current = examples; }, [examples]);

  useEffect(() => {
    if (!enabled || examplesRef.current.length === 0) {
      setText("");
      return;
    }
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;
    let exampleIndex = 0;

    const typeNext = (charIndex: number) => {
      if (cancelled) return;
      const current = examplesRef.current[exampleIndex % examplesRef.current.length];
      setText(current.slice(0, charIndex));
      if (charIndex < current.length) {
        timeout = setTimeout(() => typeNext(charIndex + 1), TYPE_MS);
      } else {
        timeout = setTimeout(() => eraseNext(current.length), HOLD_MS);
      }
    };

    const eraseNext = (charIndex: number) => {
      if (cancelled) return;
      const current = examplesRef.current[exampleIndex % examplesRef.current.length];
      setText(current.slice(0, charIndex));
      if (charIndex > 0) {
        timeout = setTimeout(() => eraseNext(charIndex - 1), ERASE_MS);
      } else {
        exampleIndex += 1;
        timeout = setTimeout(() => typeNext(0), GAP_MS);
      }
    };

    timeout = setTimeout(() => typeNext(0), GAP_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [enabled]);

  return text;
}

export default function ChatInput({
  onSend,
  placeholder,
  examples = [],
  busy = false,
}: {
  onSend: (text: string) => void;
  /** Static placeholder — shown as-is while `busy`, or as a fallback before the first example types in. */
  placeholder: string;
  /** Things the agent can help with, typed out one at a time to show the user what's in scope. */
  examples?: string[];
  busy?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const animated = useTypewriterPlaceholder(examples, !busy && draft.length === 0);
  const shownPlaceholder = busy ? placeholder : animated || placeholder;

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
          placeholder={shownPlaceholder}
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
