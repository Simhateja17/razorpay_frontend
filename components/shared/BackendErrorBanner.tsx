"use client";

import { useAppState } from "@/lib/store/AppState";

export default function BackendErrorBanner() {
  const { backendError } = useAppState();
  if (!backendError) return null;

  return (
    <div className="flex-none bg-danger-bg border-b border-danger-border px-5 py-2 text-[12.5px] text-danger flex items-center gap-2">
      <span className="font-semibold">Backend unreachable:</span>
      <span>{backendError}</span>
      <span className="text-ink-faint ml-1">— is `uvicorn api.main:app --port 8000` running?</span>
    </div>
  );
}
