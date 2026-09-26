"use client";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv, SupabaseNotConfiguredError } from "./env";

export function createClient() {
  const env = getSupabasePublicEnv();
  if (!env) throw new SupabaseNotConfiguredError();
  return createBrowserClient(env.url, env.anonKey);
}
