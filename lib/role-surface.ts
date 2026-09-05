export type AppRole = "customer" | "merchant_operator";

export interface SurfaceTab {
  href: string;
  label: string;
}

const CUSTOMER_TABS: readonly SurfaceTab[] = [
  { href: "/storefront", label: "Storefront" },
  { href: "/evidence", label: "Evidence" },
];

const OPERATOR_TABS: readonly SurfaceTab[] = [
  { href: "/portal", label: "Merchant portal" },
  { href: "/evidence", label: "Evidence" },
  { href: "/operations", label: "Operations" },
];

/**
 * Signed-out visitors see every surface's entry point. Both role sets link to
 * /evidence, so the union is deduplicated by href — otherwise the tab renders twice.
 */
const PUBLIC_TABS: readonly SurfaceTab[] = [...CUSTOMER_TABS, ...OPERATOR_TABS].filter(
  (tab, index, tabs) => tabs.findIndex((other) => other.href === tab.href) === index,
);

/**
 * The role is read from Supabase app metadata by the authenticated client and
 * from the verified token by the backend. Missing metadata follows the backend's
 * customer default; it never grants an operator surface.
 */
export function roleFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): AppRole {
  return metadata?.cartisan_role === "merchant_operator"
    ? "merchant_operator"
    : "customer";
}

export function navigationForRole(role: AppRole | null): readonly SurfaceTab[] {
  if (role === "merchant_operator") return OPERATOR_TABS;
  if (role === "customer") return CUSTOMER_TABS;
  return PUBLIC_TABS;
}

function isRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** Return a safe in-app destination when a signed-in role opens another role's route. */
export function redirectForRole(role: AppRole, pathname: string): string | null {
  if (role === "merchant_operator") {
    if (isRoute(pathname, "/storefront")) return "/portal";
    return null;
  }
  if (isRoute(pathname, "/portal") || isRoute(pathname, "/operations")) {
    return "/storefront";
  }
  return null;
}
