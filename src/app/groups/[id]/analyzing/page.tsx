import { redirect } from "next/navigation";
import { AnalyzeRunner } from "@/components/group/analyze-runner";
import { SupabaseMissing } from "@/components/supabase-missing";
import { requireGroup } from "@/lib/group-page";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Comparing listings" };

export default async function AnalyzingPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return <SupabaseMissing />;
  const { id } = await params;
  const { group, isCoordinator } = await requireGroup(id);
  if (group.status === "analyzed") redirect(`/groups/${id}/results`);
  if (!isCoordinator) redirect(`/groups/${id}`);
  return <AnalyzeRunner groupId={id} />;
}
