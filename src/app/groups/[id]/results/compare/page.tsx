import Link from "next/link";
import { CompareTable } from "@/components/results/compare-table";
import { DecisionFooter } from "@/components/results/bits";
import { SupabaseMissing } from "@/components/supabase-missing";
import { PageHeader } from "@/components/ui";
import { loadGroupResults } from "@/lib/group-results";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Compare options" };

export default async function GroupCompare({ params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return <SupabaseMissing />;
  const { id } = await params;
  const data = await loadGroupResults(id);
  return (
    <div>
      <Link href={data.basePath} className="text-sm text-accent underline underline-offset-2">← Back to options</Link>
      <div className="mt-4">
        <PageHeader eyebrow={data.groupName} title="Side by side">Same facts for each option, in the same order. Nothing is marked as the winner.</PageHeader>
      </div>
      <CompareTable options={data.shortlist} />
      <DecisionFooter />
    </div>
  );
}
