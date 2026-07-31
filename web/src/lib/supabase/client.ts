import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/** Dashboard remoto usa publishable key; local sigue con anon JWT. */
function supabaseAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    ""
  );
}

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey(),
  );
}
