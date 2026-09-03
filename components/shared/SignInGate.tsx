"use client";

import { useState } from "react";
import { useAppState } from "@/lib/store/AppState";
import { DEMO_IDENTITIES } from "@/lib/supabase";

/**
 * The storefront requires a real Supabase session. Cart ownership, orders, and
 * checkout are all derived from the verified principal, so there is no anonymous
 * shopping path to fall back to — the demo identities are pre-created accounts,
 * not a bypass.
 */
export default function SignInGate({ children }: { children: React.ReactNode }) {
  const { session, authReady, authConfigured, signIn } = useAppState();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (session) return <>{children}</>;

  if (!authReady) {
    return <div className="h-full grid place-items-center text-[13px] text-ink-faint">Checking your session…</div>;
  }

  async function chooseIdentity(email: string, password: string) {
    setBusy(email);
    setError(await signIn(email, password));
    setBusy(null);
  }

  return (
    <div className="h-full grid place-items-center px-6">
      <div className="w-full max-w-[420px] flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="w-[34px] h-[34px] rounded-[9px] bg-accent text-white flex items-center justify-center text-[15px] font-semibold">
            C
          </div>
          <h1 className="mt-1 text-[24px] font-semibold tracking-tight">Sign in to shop</h1>
          <p className="m-0 text-[14px] text-ink-muted leading-relaxed">
            Your cart and orders belong to your account, not to this browser tab. Pick a demo
            identity to continue — sign in again from anywhere and the same cart is waiting.
          </p>
        </div>

        {!authConfigured && (
          <p className="m-0 text-[13px] text-danger leading-relaxed">
            Supabase Auth is not configured for this build. Set{" "}
            <code className="font-mono text-[12px]">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="font-mono text-[12px]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {DEMO_IDENTITIES.map((identity) => (
            <button
              key={identity.email}
              disabled={!authConfigured || busy !== null}
              onClick={() => chooseIdentity(identity.email, identity.password)}
              className="bg-white border border-border rounded-[9px] px-4 py-3 text-left hover:border-accent disabled:opacity-50 transition-colors"
            >
              <span className="block text-[13.5px] font-medium">{identity.label}</span>
              <span className="block font-mono text-[11px] text-ink-faint mt-0.5">
                {busy === identity.email ? "signing in…" : identity.email}
              </span>
            </button>
          ))}
        </div>

        {error && <p className="m-0 text-[13px] text-danger">{error}</p>}
      </div>
    </div>
  );
}
