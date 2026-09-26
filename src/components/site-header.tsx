import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";

export async function SiteHeader() {
  let email: string | null = null;
  if (isSupabaseConfigured()) {
    try {
      const { user } = await getUser();
      email = user?.email ?? null;
    } catch {
      email = null;
    }
  }
  return (
    <header className="border-b border-line bg-surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-ink">
          <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm text-accent-ink">
            F
          </span>
          FlatMatch
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-3" aria-label="Main">
          <Link href="/demo" className="rounded-md px-2 py-2 text-ink-2 hover:text-ink">
            Demo
          </Link>
          {email ? (
            <>
              <Link href="/dashboard" className="rounded-md px-2 py-2 text-ink-2 hover:text-ink">
                My searches
              </Link>
              <form action={signOut}>
                <button className="rounded-md px-2 py-2 text-ink-2 hover:text-ink" type="submit">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="rounded-md px-2 py-2 text-ink-2 hover:text-ink">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
