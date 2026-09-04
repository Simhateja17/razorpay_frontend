"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppState } from "@/lib/store/AppState";
import SignInGate from "@/components/shared/SignInGate";
import { redirectForRole, roleFromMetadata } from "@/lib/role-surface";
import type { AppRole } from "@/lib/role-surface";

/**
 * Render a surface only for its owning role. The backend remains authoritative;
 * this gate keeps a signed-in person from being shown the other role's UI while
 * direct navigation is redirected to a surface their verified role can use.
 */
export default function RoleGate({
  role,
  children,
}: {
  role: AppRole;
  children: ReactNode;
}) {
  const { session, authReady } = useAppState();
  const pathname = usePathname();
  const router = useRouter();
  const actualRole = session ? roleFromMetadata(session.user.app_metadata) : null;
  const roleDestination = actualRole && pathname
    ? redirectForRole(actualRole, pathname)
    : null;
  const destination = actualRole && actualRole !== role
    ? roleDestination ?? (role === "customer" ? "/storefront" : "/portal")
    : null;

  useEffect(() => {
    if (authReady && destination) router.replace(destination);
  }, [authReady, destination, router]);

  if (!authReady) {
    return (
      <div className="h-full grid place-items-center text-[13px] text-ink-faint">
        Checking your session…
      </div>
    );
  }

  if (!session) return <SignInGate>{children}</SignInGate>;

  if (actualRole !== role) {
    return (
      <div className="h-full grid place-items-center text-[13px] text-ink-faint">
        Opening your Cartisan surface…
      </div>
    );
  }

  return <>{children}</>;
}
