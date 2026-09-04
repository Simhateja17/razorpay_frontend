import { createClient, SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// The browser client only holds the session. It never reads or writes commerce
// tables directly: every cart, order, and checkout effect goes through the
// backend, which derives the principal from the same verified token.
export const supabase: SupabaseClient | null =
  URL && ANON_KEY ? createClient(URL, ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

export const supabaseConfigured = Boolean(supabase);

/** Pre-created demo identities, so a judge can sign in without a signup flow. */
// The pre-created demo accounts. The role behind each one lives in Supabase app
// metadata, which a client cannot set: signing in as Maya does not *make* the session
// an operator, it signs into an account the server already knows is one (ADR 0010).
// Create them with `scripts/seed_demo_identities.py`.
export const DEMO_IDENTITIES = [
  { label: "Ira Menon — shopper", email: "ira@example.com", password: "cartisan-demo-shopper" },
  { label: "Dev Rao — shopper", email: "dev@example.com", password: "cartisan-demo-shopper" },
  { label: "Maya Iyer — merchant operator", email: "maya@example.com", password: "cartisan-demo-operator" },
];

export async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
