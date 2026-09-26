import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runMatching } from "@/lib/matching/engine";
import type { Participant } from "@/lib/matching/types";
import { explainListing, isGeminiConfigured } from "@/lib/explain/gemini";
import { getPropertyProvider, PropertyProviderUnavailableError } from "@/lib/providers/property";
import { getLocationProvider } from "@/lib/providers/location";
import { RequirementProfileSchema, toProfile } from "@/lib/validation/requirements";
import type { RunMeta } from "@/lib/groups";

export class AnalysisError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "AnalysisError";
  }
}

/**
 * Full analysis pipeline for one group, executed as the signed-in coordinator:
 * load requirements → retrieve listings → deterministic matching →
 * explanations (Gemini or rule-based fallback) → persist atomically.
 */
export async function runGroupAnalysis(supabase: SupabaseClient, groupId: string): Promise<string> {
  const { data: rows, error } = await supabase.rpc("get_group_requirements_for_analysis", { p_group: groupId });
  if (error) throw new AnalysisError(error.code === "42501" ? "Only the coordinator can start the analysis." : "Could not load requirements.", 403);

  const members = (rows ?? []) as { user_id: string; display_name: string; profile: unknown; status: string | null }[];
  if (members.length !== 3) throw new AnalysisError("FlatMatch needs exactly 3 members before it can compare listings.");
  const missing = members.filter((m) => m.status !== "submitted").map((m) => m.display_name);
  if (missing.length) throw new AnalysisError(`Still waiting for: ${missing.join(", ")}.`);

  const participants: Participant[] = members.map((m) => {
    const parsed = RequirementProfileSchema.safeParse(m.profile);
    if (!parsed.success) throw new AnalysisError(`${m.display_name}'s requirements are incomplete. Ask them to review and resubmit.`);
    return { id: m.user_id, profile: toProfile(parsed.data) };
  });

  const provider = getPropertyProvider();
  let listings;
  try {
    listings = await provider.searchListings({ city: "Pune" });
  } catch (e) {
    if (e instanceof PropertyProviderUnavailableError) throw new AnalysisError(`Property data is unavailable: ${e.message}`, 503);
    throw new AnalysisError("Property data is unavailable right now.", 503);
  }

  const location = getLocationProvider();
  const run = runMatching(listings, participants, { providerName: provider.name, locationProvider: location });
  const explanations = await Promise.all(run.shortlist.map((ev) => explainListing(ev)));

  const meta: RunMeta = {
    providerName: provider.name,
    providerIsMock: provider.isMock,
    locationProviderName: location.name,
    locationIsLive: location.isLive,
    totalListings: run.totalListings,
    geminiConfigured: isGeminiConfigured(),
    generatedAt: run.generatedAt,
    weights: run.weights,
  };

  const toRow = (ev: (typeof run.shortlist)[number], bucket: string, rank: number | null, explanation?: (typeof explanations)[number]) => ({
    listing_id: ev.property.id,
    bucket,
    rank,
    viable: ev.viable,
    group_score: ev.groupScore,
    individual_scores: Object.fromEntries(ev.participants.map((p) => [p.name, p.fitScore])),
    result: ev,
    explanation: explanation
      ? { source: explanation.source, model: explanation.model, fallback_reason: explanation.fallbackReason, content: explanation.explanation }
      : null,
  });

  const results = [
    ...run.shortlist.map((ev, i) => toRow(ev, "shortlist", i + 1, explanations[i])),
    ...run.borderline.map((ev, i) => toRow(ev, "borderline", run.shortlist.length + i + 1)),
    ...run.rejected.map((ev) => toRow(ev, "rejected", null)),
  ];

  const { data: runId, error: saveError } = await supabase.rpc("save_match_run", { p_group: groupId, p_meta: meta, p_results: results });
  if (saveError || !runId) throw new AnalysisError("Could not save the results.", 500);
  return runId as string;
}
