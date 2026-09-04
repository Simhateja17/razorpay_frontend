"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps a scrollable container pinned to the bottom while `dep` changes (new
 * messages, or a streaming message growing token by token), but only while the
 * viewer hasn't scrolled up to read earlier history — scrolling up disengages
 * the pin until they return to the bottom themselves.
 */
export function useAutoScroll<T>(dep: T) {
  const ref = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !stickToBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, [dep]);

  return ref;
}
