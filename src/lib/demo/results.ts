import "server-only";
import { unstable_cache } from "next/cache";
import type { ResultsData } from "@/components/results/types";
import { explainListing, isGeminiConfigured } from "@/lib/explain/gemini";
import { buildFallbackExplanation } from "@/lib/explain/fallback";
import type { ExplanationResult } from "@/lib/explain/types";
import { runMatching } from "@/lib/matching/engine";
import type { ListingEvaluation } from "@/lib/matching/types";
import { getLocationProvider } from "@/lib/providers/location";
import { MockPropertyProvider } from "@/lib/providers/property";
import { DEMO_PARTICIPANTS } from "./profiles";

/**
 * Gemini explanations for the fixed demo inputs are cached for a day, and only
 * successful responses are cached (a thrown error skips the cache).
 */
const cachedGemini = unstable_cache(
  async (listingId: string, evJson: string): Promise<ExplanationResult> => {
    const ev = JSON.parse(evJson) as ListingEvaluation;
    const res = await explainListing(ev);
    if (res.source !== "gemini") throw new Error(res.fallbackReason ?? "fallback");
    void listingId;
    return res;
  },
  ["demo-explanation-v1"],
  { revalidate: 86400 },
);

async function explainDemo(ev: ListingEvaluation): Promise<ExplanationResult> {
  if (!isGeminiConfigured()) return explainListing(ev);
  try {
    return await cachedGemini(ev.property.id, JSON.stringify(ev));
  } catch (e) {
    return {
      explanation: buildFallbackExplanation(ev),
      source: "fallback",
      model: null,
      fallbackReason: e instanceof Error && e.message.startsWith("Gemini") ? e.message : "Gemini was unavailable, so a rule-based explanation is shown.",
    };
  }
}

export async function getDemoResults(): Promise<ResultsData> {
  const provider = new MockPropertyProvider();
  const location = getLocationProvider();
  const listings = await provider.searchListings({ city: "Pune" });
  const run = runMatching(listings, DEMO_PARTICIPANTS, {
    providerName: provider.name,
    locationProvider: location,
    now: new Date("2026-09-26T00:00:00Z"),
  });
  const explanations = await Promise.all(run.shortlist.map(explainDemo));
  return {
    mode: "demo",
    basePath: "/demo",
    title: "Three flats that pass everyone's dealbreakers",
    shortlist: run.shortlist.map((evaluation, i) => ({ evaluation, explanation: explanations[i] })),
    borderline: run.borderline,
    rejected: run.rejected,
    meta: {
      providerName: provider.name,
      providerIsMock: provider.isMock,
      locationProviderName: location.name,
      locationIsLive: location.isLive,
      totalListings: run.totalListings,
      geminiConfigured: isGeminiConfigured(),
      generatedAt: run.generatedAt,
      weights: run.weights,
    },
  };
}
