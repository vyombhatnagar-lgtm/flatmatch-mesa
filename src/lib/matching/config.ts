import type { Priority } from "./types";

/**
 * All tunable matching parameters live here.
 * Change these values to re-balance the engine; tests read from this file too.
 */
export const PRIORITY_WEIGHTS: Record<Priority, number> = {
  /** Dealbreakers are hard gates, not weights. A violation removes the listing. */
  DEALBREAKER: 0,
  MUST_HAVE: 100,
  STRONG_PREFERENCE: 50,
  NICE_TO_HAVE: 20,
  NOT_IMPORTANT: 0,
};

export const MATCHING_CONFIG = {
  /** Number of listings to shortlist. */
  shortlistSize: 3,
  /** Minimum number of options we try to show when at least this many are viable. */
  minimumOptions: 2,
  /**
   * Group compatibility blends the average individual fit with the *lowest*
   * individual fit. The min term stops a listing from scoring well by
   * serving two people brilliantly while leaving the third behind.
   */
  groupScore: { meanWeight: 0.6, minWeight: 0.4 },
  /** Budget: satisfaction falls to 0 when the share is this fraction over the max. */
  budgetTolerance: 0.25,
  /** Commute: satisfaction falls to 0 when the commute is this fraction over the target. */
  commuteTolerance: 1.0,
  /** Credit given for a listing in an "acceptable" (not preferred) area. */
  acceptableAreaCredit: 0.6,
  /** A requirement at/above this satisfaction counts as "met". */
  metThreshold: 0.999,
  /** Below this satisfaction a requirement is "unmet" rather than "partial". */
  partialThreshold: 0.001,
  /** Borderline listings: viable but with this many or more severe compromises across the group. */
  borderlineSevereCount: 2,
} as const;

export const PRIORITY_LABELS: Record<Priority, string> = {
  DEALBREAKER: "Dealbreaker",
  MUST_HAVE: "Must have",
  STRONG_PREFERENCE: "Strong preference",
  NICE_TO_HAVE: "Nice to have",
  NOT_IMPORTANT: "Not important",
};

export const PRIORITY_HELP: Record<Priority, string> = {
  DEALBREAKER: "Any flat that fails this is removed for the whole group.",
  MUST_HAVE: "Heavily weighted. Missing it is flagged as a severe compromise.",
  STRONG_PREFERENCE: "Matters a lot, but can be traded off.",
  NICE_TO_HAVE: "A small bonus.",
  NOT_IMPORTANT: "Ignored in scoring.",
};
