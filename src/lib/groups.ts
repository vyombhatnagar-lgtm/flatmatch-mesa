import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExplanationResult } from "@/lib/explain/types";
import type { ListingEvaluation } from "@/lib/matching/types";

export interface GroupMemberProgress {
  user_id: string;
  display_name: string;
  role: "coordinator" | "participant";
  status: "draft" | "submitted" | null;
  submitted_at: string | null;
  joined_at: string;
}

export interface GroupRow {
  id: string;
  name: string;
  city: string;
  coordinator_id: string;
  status: "collecting" | "analyzed";
  latest_run_id: string | null;
  latest_run_meta: RunMeta | null;
  analyzed_at: string | null;
  created_at: string;
}

export interface RunMeta {
  providerName: string;
  providerIsMock: boolean;
  locationProviderName: string;
  locationIsLive: boolean;
  totalListings: number;
  geminiConfigured: boolean;
  generatedAt: string;
  weights: Record<string, number>;
}

export interface InvitationRow {
  id: string;
  token: string;
  label: string | null;
  status: "pending" | "accepted" | "revoked";
  expires_at: string;
  accepted_by: string | null;
}

export async function loadGroup(supabase: SupabaseClient, groupId: string) {
  const { data: group } = await supabase.from("search_groups").select("*").eq("id", groupId).maybeSingle<GroupRow>();
  if (!group) return null;
  const { data: progress } = await supabase.rpc("get_group_progress", { p_group: groupId });
  return { group, members: (progress ?? []) as GroupMemberProgress[] };
}

export async function loadInvitations(supabase: SupabaseClient, groupId: string) {
  const { data } = await supabase
    .from("invitations")
    .select("id, token, label, status, expires_at, accepted_by")
    .eq("group_id", groupId)
    .order("created_at");
  return (data ?? []) as InvitationRow[];
}

export interface StoredResult {
  bucket: "shortlist" | "borderline" | "rejected";
  rank: number | null;
  evaluation: ListingEvaluation;
  explanation: ExplanationResult | null;
}

export async function loadLatestResults(supabase: SupabaseClient, group: GroupRow): Promise<StoredResult[]> {
  if (!group.latest_run_id) return [];
  const { data } = await supabase
    .from("match_results")
    .select("bucket, rank, result, match_explanations(source, model, fallback_reason, content)")
    .eq("group_id", group.id)
    .eq("run_id", group.latest_run_id)
    .order("rank", { ascending: true, nullsFirst: false });
  type Row = {
    bucket: StoredResult["bucket"];
    rank: number | null;
    result: ListingEvaluation;
    match_explanations:
      | { source: "gemini" | "fallback"; model: string | null; fallback_reason: string | null; content: ExplanationResult["explanation"] }
      | { source: "gemini" | "fallback"; model: string | null; fallback_reason: string | null; content: ExplanationResult["explanation"] }[]
      | null;
  };
  return ((data ?? []) as Row[]).map((r) => {
    const ex = Array.isArray(r.match_explanations) ? r.match_explanations[0] : r.match_explanations;
    return {
      bucket: r.bucket,
      rank: r.rank,
      evaluation: r.result,
      explanation: ex
        ? { source: ex.source, model: ex.model, fallbackReason: ex.fallback_reason, explanation: ex.content }
        : null,
    };
  });
}
