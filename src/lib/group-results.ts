import "server-only";
import { redirect } from "next/navigation";
import type { ResultsData } from "@/components/results/types";
import { requireGroup } from "@/lib/group-page";
import { loadLatestResults } from "@/lib/groups";

export async function loadGroupResults(id: string): Promise<ResultsData & { isCoordinator: boolean; groupName: string }> {
  const { supabase, group, isCoordinator } = await requireGroup(id);
  if (group.status !== "analyzed" || !group.latest_run_id || !group.latest_run_meta) redirect(`/groups/${id}`);
  const rows = await loadLatestResults(supabase, group);
  return {
    mode: "group",
    basePath: `/groups/${id}/results`,
    title: group.name,
    groupName: group.name,
    isCoordinator,
    shortlist: rows.filter((r) => r.bucket === "shortlist").map((r) => ({ evaluation: r.evaluation, explanation: r.explanation })),
    borderline: rows.filter((r) => r.bucket === "borderline").map((r) => r.evaluation),
    rejected: rows.filter((r) => r.bucket === "rejected").map((r) => r.evaluation),
    meta: group.latest_run_meta,
  };
}
