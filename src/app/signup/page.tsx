import { AuthForm } from "@/components/auth/auth-form";
import { SupabaseMissing } from "@/components/supabase-missing";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Create account" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (!isSupabaseConfigured()) return <SupabaseMissing />;
  return <AuthForm mode="signup" next={safe} />;
}
