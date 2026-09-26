import Link from "next/link";
import { ResultsView } from "@/components/results/results-view";
import { SupabaseMissing } from "@/components/supabase-missing";
import { loadGroupResults } from "@/lib/group-results";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Results" };

export default async function GroupResults({ params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return <SupabaseMissing />;
  const { id } = await params;
  const data = await loadGroupResults(id);
  return (
    <div>
      <Link href={`/groups/${id}`} className="mb-4 inline-block text-sm text-accent underline underline-offset-2">← Group status</Link>
      <ResultsView data={data} />
    </div>
  );
}
