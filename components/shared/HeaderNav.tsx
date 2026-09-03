"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "@/lib/store/AppState";

const TABS = [
  { href: "/storefront", label: "Storefront" },
  { href: "/portal", label: "Merchant portal" },
  { href: "/audit", label: "Audit trail" },
];

export default function HeaderNav() {
  const pathname = usePathname();
  const { session, signOut } = useAppState();

  return (
    <header className="flex-none flex items-center gap-5 px-5 h-14 bg-surface border-b border-border">
      <div className="flex items-baseline gap-2">
        <span className="text-[17px] font-semibold tracking-tight">Cartisan</span>
        <span className="font-mono text-[10px] text-ink-faint tracking-wide">AGENTIC COMMERCE</span>
      </div>
      <nav className="flex gap-1 p-[3px] bg-surface-muted rounded-[9px]">
        {TABS.map((t) => {
          const active = pathname?.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`px-3.5 py-1.5 rounded-md text-sm transition-colors ${
                active ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        {session?.user.email && (
          <span className="flex items-center gap-2 text-[12.5px] text-ink-muted">
            {session.user.email}
            <button onClick={signOut} className="text-ink-faint hover:text-ink underline underline-offset-2">
              Sign out
            </button>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-ink-muted bg-surface-muted border border-border px-2 py-1 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          SUPABASE DATA · TEST MODE
        </span>
      </div>
    </header>
  );
}
