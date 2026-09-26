/**
 * FlatMatch deterministic matching engine.
 *
 * Pure TypeScript, no I/O, no AI. Given a set of participants and listings it
 * produces identical output every time. The LLM layer only *explains* this
 * output; it never influences which listings pass or how they score.
 *
 * Phases
 *  1. Dealbreaker filtering  – any violation for any person removes the listing
 *  2. Must-have evaluation   – counted per person; misses are severe compromises
 *  3. Preference scoring     – strong / nice-to-have weighted per config
 *  4. Individual fit         – weighted satisfaction 0–100 per person
 *  5. Group fit              – blend of mean and minimum individual fit
 */
import { MATCHING_CONFIG, PRIORITY_WEIGHTS } from "./config";
import { inr, listJoin } from "@/lib/format";
import type { LocationProvider } from "@/lib/providers/location";
import { ApproximateLocationProvider } from "@/lib/providers/location";
import type {
  Amenity,
  ListingEvaluation,
  MatchRun,
  Participant,
  ParticipantResult,
  Priority,
  Property,
  RequirementKey,
  RequirementResult,
  RequirementStatus,
  SharedItem,
} from "./types";

export const AMENITY_LABELS: Record<Amenity, string> = {
  gated_society: "Gated society",
  power_backup: "Power backup",
  water_24x7: "24x7 water",
  security: "24x7 security",
  gym: "Gym",
  near_metro: "Near metro",
  washing_machine: "Washing machine",
  air_conditioning: "Air conditioning",
};

/** Generic labels used when a requirement is described at group level. */
export const KEY_LABELS: Record<string, string> = {
  budget: "Within budget",
  preferred_rent: "At or below preferred rent",
  utilities: "Utilities included",
  commute: "Commute to work",
  secondary_commute: "Commute to second destination",
  areas: "Preferred area",
  excluded_areas: "Not in an excluded area",
  bedrooms: "Enough bedrooms",
  bathrooms: "Enough bathrooms",
  lift: "Lift access",
  parking: "Parking",
  furnishing: "Furnishing",
  pet_friendly: "Pet friendly",
  balcony: "Balcony",
  floor: "Floor preference",
};

export function keyLabel(key: RequirementKey): string {
  if (key.startsWith("amenity:")) return AMENITY_LABELS[key.slice(8) as Amenity] ?? key;
  return KEY_LABELS[key] ?? key;
}

const PRIORITY_ORDER: Priority[] = [
  "DEALBREAKER",
  "MUST_HAVE",
  "STRONG_PREFERENCE",
  "NICE_TO_HAVE",
  "NOT_IMPORTANT",
];

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function statusFor(s: number): RequirementStatus {
  if (s >= MATCHING_CONFIG.metThreshold) return "met";
  if (s <= MATCHING_CONFIG.partialThreshold) return "unmet";
  return "partial";
}

function result(
  key: RequirementKey,
  label: string,
  priority: Priority,
  satisfaction: number,
  detail: string,
): RequirementResult {
  const s = clamp01(satisfaction);
  return {
    key,
    label,
    priority,
    satisfaction: Math.round(s * 1000) / 1000,
    status: statusFor(s),
    detail,
    weight: PRIORITY_WEIGHTS[priority],
  };
}

export interface EngineOptions {
  locationProvider?: LocationProvider;
  providerName?: string;
  now?: Date;
}

/** Evaluate every requirement of one participant against one listing. */
export function evaluateParticipant(
  participant: Participant,
  property: Property,
  groupSize: number,
  location: LocationProvider,
): ParticipantResult {
  const p = participant.profile;
  const out: RequirementResult[] = [];
  const important = (priority: Priority | undefined) => !!priority && priority !== "NOT_IMPORTANT";
  const share = Math.round(property.rent / Math.max(1, groupSize));
  const propertyPoint = { lat: property.latitude, lng: property.longitude };

  // Budget
  if (important(p.maxRent?.priority) && p.maxRent.value > 0) {
    const max = p.maxRent.value;
    const over = share <= max ? 0 : (share - max) / max;
    const s = over === 0 ? 1 : 1 - over / MATCHING_CONFIG.budgetTolerance;
    out.push(
      result(
        "budget",
        `Rent share ≤ ${inr(max)}`,
        p.maxRent.priority,
        s,
        share <= max
          ? `Share ${inr(share)} is within max ${inr(max)}`
          : `Share ${inr(share)} is ${inr(share - max)} over max ${inr(max)}`,
      ),
    );
  }

  // Preferred rent
  if (p.preferredRent && important(p.preferredRent.priority) && p.preferredRent.value > 0) {
    const pref = p.preferredRent.value;
    const max = p.maxRent?.value ?? pref;
    let s: number;
    if (share <= pref) s = 1;
    else if (max > pref) s = 1 - (share - pref) / (max - pref);
    else s = 0;
    out.push(
      result(
        "preferred_rent",
        `Rent share around ${inr(pref)}`,
        p.preferredRent.priority,
        s,
        share <= pref ? `Share ${inr(share)} is at or below ${inr(pref)}` : `Share ${inr(share)} vs preferred ${inr(pref)}`,
      ),
    );
  }

  // Utilities
  if (important(p.utilitiesIncluded?.priority) && p.utilitiesIncluded.value) {
    out.push(
      result(
        "utilities",
        "Utilities included in rent",
        p.utilitiesIncluded.priority,
        property.utilitiesIncluded ? 1 : 0,
        property.utilitiesIncluded ? "Utilities included" : "Utilities paid separately",
      ),
    );
  }

  // Commute (work)
  let commuteMinutes: number | null = null;
  if (p.work?.point) {
    const est = location.estimateCommute(propertyPoint, p.work.point);
    commuteMinutes = est.minutes;
    if (important(p.commute?.priority) && p.commute.value > 0) {
      const t = p.commute.value;
      const s = est.minutes <= t ? 1 : 1 - (est.minutes - t) / (t * MATCHING_CONFIG.commuteTolerance);
      out.push(
        result(
          "commute",
          `Commute to ${p.work.label} ≤ ${t} min`,
          p.commute.priority,
          s,
          `~${est.minutes} min${est.isEstimate ? " (estimate)" : ""} vs ${t} min target`,
        ),
      );
    }
  }

  // Commute (secondary destination)
  if (p.secondaryDestination?.point && p.secondaryCommute && important(p.secondaryCommute.priority)) {
    const est = location.estimateCommute(propertyPoint, p.secondaryDestination.point);
    const t = p.secondaryCommute.value;
    const s = est.minutes <= t ? 1 : 1 - (est.minutes - t) / (t * MATCHING_CONFIG.commuteTolerance);
    out.push(
      result(
        "secondary_commute",
        `Reach ${p.secondaryDestination.label} ≤ ${t} min`,
        p.secondaryCommute.priority,
        s,
        `~${est.minutes} min${est.isEstimate ? " (estimate)" : ""} vs ${t} min target`,
      ),
    );
  }

  // Areas
  const pref = p.areas?.value.preferred ?? [];
  const acc = p.areas?.value.acceptable ?? [];
  if (important(p.areas?.priority) && (pref.length || acc.length)) {
    const inPref = pref.includes(property.locality);
    const inAcc = acc.includes(property.locality);
    const s = inPref ? 1 : inAcc ? MATCHING_CONFIG.acceptableAreaCredit : 0;
    out.push(
      result(
        "areas",
        `Preferred area (${listJoin(pref.slice(0, 3)) || "none set"})`,
        p.areas.priority,
        s,
        inPref
          ? `${property.locality} is a preferred area`
          : inAcc
            ? `${property.locality} is acceptable, not preferred`
            : `${property.locality} is not on the preferred or acceptable list`,
      ),
    );
  }

  // Excluded areas
  const excluded = p.excludedAreas?.value ?? [];
  if (important(p.excludedAreas?.priority) && excluded.length) {
    const hit = excluded.includes(property.locality);
    out.push(
      result(
        "excluded_areas",
        `Not in ${listJoin(excluded)}`,
        p.excludedAreas.priority,
        hit ? 0 : 1,
        hit ? `${property.locality} is an area ${p.name} excluded` : `Not in an excluded area`,
      ),
    );
  }

  // Bedrooms
  if (important(p.bedrooms?.priority) && p.bedrooms.value > 0) {
    const v = p.bedrooms.value;
    out.push(
      result(
        "bedrooms",
        `At least ${v} bedrooms`,
        p.bedrooms.priority,
        property.bedrooms >= v ? 1 : 0,
        `${property.bedrooms} bedrooms`,
      ),
    );
  }

  // Bathrooms
  if (important(p.bathrooms?.priority) && p.bathrooms.value > 0) {
    const v = p.bathrooms.value;
    out.push(
      result(
        "bathrooms",
        `At least ${v} bathrooms`,
        p.bathrooms.priority,
        property.bathrooms >= v ? 1 : property.bathrooms / v,
        `${property.bathrooms} bathroom${property.bathrooms === 1 ? "" : "s"}`,
      ),
    );
  }

  // Lift
  if (important(p.lift?.priority) && p.lift.value.required) {
    const above = p.lift.value.aboveFloor;
    const needed = property.floor > above;
    const ok = !needed || property.lift;
    out.push(
      result(
        "lift",
        above > 0 ? `Lift if above floor ${above}` : "Lift",
        p.lift.priority,
        ok ? 1 : 0,
        property.lift
          ? `Lift available (floor ${property.floor})`
          : needed
            ? `No lift, flat is on floor ${property.floor} of ${property.totalFloors}`
            : `No lift, but floor ${property.floor} is within limit`,
      ),
    );
  }

  // Parking
  if (important(p.parking?.priority) && p.parking.value !== "none") {
    const want = p.parking.value;
    const ok = want === "car" ? property.parking === "car" : property.parking !== "none";
    out.push(
      result(
        "parking",
        want === "car" ? "Car parking" : "Two-wheeler parking",
        p.parking.priority,
        ok ? 1 : 0,
        property.parking === "none" ? "No parking" : `${property.parking === "car" ? "Car" : "Two-wheeler only"} parking`,
      ),
    );
  }

  // Furnishing
  const furn = p.furnishing?.value ?? [];
  if (important(p.furnishing?.priority) && furn.length) {
    const ok = furn.includes(property.furnishing);
    const partial = !ok && furn.includes("furnished") && property.furnishing === "semi-furnished";
    out.push(
      result(
        "furnishing",
        furn.length === 1 ? `${cap(furn[0])}` : `${furn.map(cap).join(" or ")}`,
        p.furnishing.priority,
        ok ? 1 : partial ? 0.5 : 0,
        cap(property.furnishing),
      ),
    );
  }

  // Pets
  if (important(p.petFriendly?.priority) && p.petFriendly.value) {
    out.push(
      result(
        "pet_friendly",
        "Pet friendly",
        p.petFriendly.priority,
        property.petFriendly ? 1 : 0,
        property.petFriendly ? "Pets allowed" : "Pets not allowed",
      ),
    );
  }

  // Balcony
  if (important(p.balcony?.priority) && p.balcony.value) {
    out.push(
      result("balcony", "Balcony", p.balcony.priority, property.balcony ? 1 : 0, property.balcony ? "Has a balcony" : "No balcony"),
    );
  }

  // Floor
  const fl = p.floor?.value;
  if (important(p.floor?.priority) && fl && (fl.min != null || fl.max != null)) {
    const ok = (fl.min == null || property.floor >= fl.min) && (fl.max == null || property.floor <= fl.max);
    const range = fl.min != null && fl.max != null ? `floors ${fl.min}–${fl.max}` : fl.min != null ? `floor ${fl.min}+` : `floor ≤ ${fl.max}`;
    out.push(result("floor", `Prefers ${range}`, p.floor.priority, ok ? 1 : 0, `Floor ${property.floor} of ${property.totalFloors}`));
  }

  // Amenities
  for (const a of p.amenities ?? []) {
    if (!important(a.priority)) continue;
    const has = property.amenities.includes(a.amenity);
    out.push(
      result(`amenity:${a.amenity}`, AMENITY_LABELS[a.amenity], a.priority, has ? 1 : 0, has ? `Has ${AMENITY_LABELS[a.amenity].toLowerCase()}` : `No ${AMENITY_LABELS[a.amenity].toLowerCase()}`),
    );
  }

  // --- Aggregate --------------------------------------------------------
  const dealbreakerViolations = out.filter((r) => r.priority === "DEALBREAKER" && r.status !== "met");
  const scored = out.filter((r) => r.weight > 0);
  const totalW = scored.reduce((a, r) => a + r.weight, 0);
  const gotW = scored.reduce((a, r) => a + r.weight * r.satisfaction, 0);
  const fitScore = totalW === 0 ? 100 : Math.round((gotW / totalW) * 100);

  const byPriority = (a: RequirementResult, b: RequirementResult) =>
    PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) || a.satisfaction - b.satisfaction;

  const gets = out.filter((r) => r.status === "met").sort(byPriority);
  const compromises = out.filter((r) => r.status !== "met" && r.priority !== "DEALBREAKER").sort(byPriority);
  const severeCompromises = compromises.filter((r) => r.priority === "MUST_HAVE");
  const musts = out.filter((r) => r.priority === "MUST_HAVE");

  return {
    participantId: participant.id,
    name: p.name,
    fitScore,
    rentShare: share,
    mustHavesTotal: musts.length,
    mustHavesMet: musts.filter((r) => r.status === "met").length,
    dealbreakersPassed: dealbreakerViolations.length === 0,
    dealbreakerViolations,
    gets,
    compromises,
    severeCompromises,
    results: out,
    commuteMinutes,
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function computeGroupScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const min = Math.min(...scores);
  const { meanWeight, minWeight } = MATCHING_CONFIG.groupScore;
  return Math.round(mean * meanWeight + min * minWeight);
}

function sharedItems(participants: ParticipantResult[]): { everyone: SharedItem[]; individual: SharedItem[] } {
  const keys = new Map<RequirementKey, { people: string[]; allMet: boolean }>();
  for (const pr of participants) {
    for (const r of pr.results) {
      const entry = keys.get(r.key) ?? { people: [], allMet: true };
      if (r.status === "met") entry.people.push(pr.name);
      else entry.allMet = false;
      keys.set(r.key, entry);
    }
  }
  const everyone: SharedItem[] = [];
  const individual: SharedItem[] = [];
  for (const [key, v] of keys) {
    if (!v.allMet || v.people.length === 0) continue;
    const item = { key, label: keyLabel(key), people: v.people };
    if (v.people.length >= 2) everyone.push(item);
    else individual.push(item);
  }
  return { everyone, individual };
}

function discussionPoints(evalParticipants: ParticipantResult[]): string[] {
  const points: string[] = [];

  // Rent split negotiation: someone over budget while someone else has headroom.
  const budgets = evalParticipants
    .map((p) => ({ p, r: p.results.find((x) => x.key === "budget") }))
    .filter((x) => x.r);
  const over = budgets.filter((x) => x.r!.status !== "met");
  if (over.length) {
    const headroom = budgets.filter((x) => x.r!.status === "met");
    for (const o of over) {
      const detail = o.r!.detail;
      if (headroom.length) {
        points.push(
          `An equal split breaks ${o.p.name}'s budget (${detail}). Would ${listJoin(headroom.map((h) => h.p.name))} consider an unequal split, e.g. ${o.p.name} taking the smallest room for less?`,
        );
      } else {
        points.push(`An equal split breaks ${o.p.name}'s budget (${detail}). Can the rent be negotiated down?`);
      }
    }
  }

  // Severe compromises first, then strong-preference compromises.
  for (const pr of evalParticipants) {
    for (const c of pr.severeCompromises) {
      if (c.key === "budget") continue;
      points.push(`${pr.name} marked “${c.label}” as a must-have and this flat misses it (${c.detail}). What workaround, if any, would ${pr.name} accept?`);
    }
  }
  for (const pr of evalParticipants) {
    for (const c of pr.compromises.filter((x) => x.priority === "STRONG_PREFERENCE")) {
      points.push(`${pr.name} would compromise on “${c.label}” (${c.detail}). What would make that trade-off easier for ${pr.name}?`);
    }
  }
  if (points.length === 0) {
    points.push("No major compromises were detected. Check what the numbers can't capture: the owner, the neighbourhood at night, and the actual rooms.");
  }
  return points.slice(0, 6);
}

function shortlistReason(ev: Omit<ListingEvaluation, "shortlistReason">): string {
  const mustTotal = ev.participants.reduce((a, p) => a + p.mustHavesTotal, 0);
  const mustMet = ev.participants.reduce((a, p) => a + p.mustHavesMet, 0);
  const lowest = [...ev.participants].sort((a, b) => a.fitScore - b.fitScore)[0];
  const parts = [
    `Passes every dealbreaker for all ${ev.participants.length} people.`,
    `${mustMet} of ${mustTotal} must-haves met across the group.`,
  ];
  if (lowest) parts.push(`Lowest individual fit: ${lowest.name} at ${lowest.fitScore}%.`);
  return parts.join(" ");
}

export function evaluateListing(
  property: Property,
  participants: Participant[],
  location: LocationProvider,
): ListingEvaluation {
  const prs = participants.map((pt) => evaluateParticipant(pt, property, participants.length, location));
  const viable = prs.every((p) => p.dealbreakersPassed);
  const groupScore = computeGroupScore(prs.map((p) => p.fitScore));
  const { everyone, individual } = sharedItems(prs);
  const partial: Omit<ListingEvaluation, "shortlistReason"> = {
    property,
    viable,
    groupScore,
    participants: prs,
    satisfiedByEveryone: everyone,
    individualBenefits: individual,
    compromises: prs.flatMap((p) => p.compromises.map((item) => ({ name: p.name, item }))),
    severeCompromises: prs.flatMap((p) => p.severeCompromises.map((item) => ({ name: p.name, item }))),
    dealbreakerViolations: prs.flatMap((p) => p.dealbreakerViolations.map((item) => ({ name: p.name, item }))),
    discussionPoints: viable ? discussionPoints(prs) : [],
    commuteIsEstimate: !location.isLive,
  };
  return {
    ...partial,
    shortlistReason: viable
      ? shortlistReason(partial)
      : `Removed: ${partial.dealbreakerViolations.map((d) => `${d.name}'s dealbreaker “${d.item.label}” (${d.item.detail})`).join("; ")}.`,
  };
}

/** Deterministic ordering of viable listings. */
export function compareViable(a: ListingEvaluation, b: ListingEvaluation): number {
  return (
    a.severeCompromises.length - b.severeCompromises.length ||
    b.groupScore - a.groupScore ||
    a.property.rent - b.property.rent ||
    a.property.id.localeCompare(b.property.id)
  );
}

export function runMatching(
  listings: Property[],
  participants: Participant[],
  options: EngineOptions = {},
): MatchRun {
  if (participants.length === 0) {
    throw new Error("Cannot run matching without participants.");
  }
  const location = options.locationProvider ?? new ApproximateLocationProvider();
  const evaluations = listings.map((l) => evaluateListing(l, participants, location));
  const viable = evaluations.filter((e) => e.viable).sort(compareViable);
  const rejected = evaluations
    .filter((e) => !e.viable)
    .sort((a, b) => a.dealbreakerViolations.length - b.dealbreakerViolations.length || a.property.id.localeCompare(b.property.id));

  return {
    generatedAt: (options.now ?? new Date()).toISOString(),
    totalListings: listings.length,
    shortlist: viable.slice(0, MATCHING_CONFIG.shortlistSize),
    borderline: viable.slice(MATCHING_CONFIG.shortlistSize),
    rejected,
    weights: { ...PRIORITY_WEIGHTS },
    providerName: options.providerName ?? "unknown",
    locationProviderName: location.name,
  };
}
