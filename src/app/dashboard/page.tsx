import Link from "next/link";
import { ButtonLink, Card, Badge, PageHeader } from "@/components/ui";
import { SupabaseMissing } from "@/components/supabase-missing";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "My searches" };

export default async function Dashboard() {
  if (!isSupabaseConfigured()) return <SupabaseMissing />;
  const { supabase, user } = await getUser();
  if (!user) redirect("/login?next=/dashboard");
  const { data } = await supabase
    .from("group_members")
    .select("role, search_groups(id, name, status, created_at)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });
  type Row = { role: string; search_groups: { id: string; name: string; status: string; created_at: string } | null };
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.search_groups);

  return (
    <div>
      <PageHeader eyebrow="Dashboard" title="Your flat searches">
        Each search has exactly three people. Start one as the coordinator, or open an invite link from a friend.
      </PageHeader>
      <div className="mb-6">
        <ButtonLink href="/groups/new">Start a new search</ButtonLink>
      </div>
      {rows.length === 0 ? (
        <Card className="p-6 text-ink-2">You aren&apos;t in any searches yet.</Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <li key={r.search_groups!.id}>
              <Link href={`/groups/${r.search_groups!.id}`} className="block">
                <Card className="p-5 hover:bg-surface-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{r.search_groups!.name}</p>
                    <Badge tone={r.search_groups!.status === "analyzed" ? "accent" : "neutral"}>
                      {r.search_groups!.status === "analyzed" ? "Results ready" : "Collecting requirements"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-3">You are the {r.role}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
