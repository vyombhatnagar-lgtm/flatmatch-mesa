import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv, SupabaseNotConfiguredError } from "./env";

/**
 * Server-side Supabase client that acts as the signed-in user (anon key + the
 * user's session cookie). All queries are subject to Row Level Security.
 * FlatMatch never uses the service-role key.
 */
export async function createClient() {
  const env = getSupabasePublicEnv();
  if (!env) throw new SupabaseNotConfiguredError();
  const cookieStore = await cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: middleware refreshes the session instead.
        }
      },
    },
  });
}

export async function getUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}
