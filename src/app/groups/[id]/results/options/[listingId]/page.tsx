import { notFound } from "next/navigation";
import { OptionDetail } from "@/components/results/option-detail";
import { OPTION_LETTERS } from "@/components/results/types";
import { SupabaseMissing } from "@/components/supabase-missing";
import { loadGroupResults } from "@/lib/group-results";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function GroupOption({ params }: { params: Promise<{ id: string; listingId: string }> }) {
  if (!isSupabaseConfigured()) return <SupabaseMissing />;
  const { id, listingId } = await params;
  const data = await loadGroupResults(id);
  const idx = data.shortlist.findIndex((o) => o.evaluation.property.id === listingId);
  if (idx < 0) notFound();
  return <OptionDetail option={data.shortlist[idx]} letter={OPTION_LETTERS[idx]} basePath={data.basePath} />;
}
