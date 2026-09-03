"use client";

import { useAppState } from "@/lib/store/AppState";

export default function BackendErrorBanner() {
  const { backendError } = useAppState();
  if (!backendError) return null;

  return (
    <div className="flex-none bg-danger-bg border-b border-danger-border px-5 py-2 text-[12.5px] text-danger flex items-center gap-2">
      <span className="font-semibold">Action could not be completed:</span>
      <span>{backendError}</span>
    </div>
  );
}
