/**
 * Core domain types for FlatMatch.
 *
 * These types are shared between the deterministic matching engine, the
 * property/location providers, the explanation layer and the UI.
 */

export const PRIORITIES = [
  "DEALBREAKER",
  "MUST_HAVE",
  "STRONG_PREFERENCE",
  "NICE_TO_HAVE",
  "NOT_IMPORTANT",
] as const;
export type Priority = (typeof PRIORITIES)[number];

export type Furnishing = "furnished" | "semi-furnished" | "unfurnished";
export type ParkingType = "none" | "two-wheeler" | "car";

export const AMENITIES = [
  "gated_society",
  "power_backup",
  "water_24x7",
  "security",
  "gym",
  "near_metro",
  "washing_machine",
  "air_conditioning",
] as const;
export type Amenity = (typeof AMENITIES)[number];

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** A property listing as returned by any PropertyProvider. */
export interface Property {
  id: string;
  title: string;
  /** Human readable location line, e.g. "Pan Card Club Road, Baner". */
  location: string;
  /** Canonical locality used for area matching, e.g. "Baner". */
  locality: string;
  city: string;
  /** Total monthly rent for the whole flat, INR. */
  rent: number;
  utilitiesIncluded: boolean;
  bedrooms: number;
  bathrooms: number;
  floor: number;
  totalFloors: number;
  lift: boolean;
  parking: ParkingType;
  furnishing: Furnishing;
  petFriendly: boolean;
  balcony: boolean;
  amenities: Amenity[];
  latitude: number;
  longitude: number;
  /** Source listing URL. For mock data this is null (no real listing exists). */
  listingUrl: string | null;
  imageUrl: string;
  description: string;
  /** Where this listing came from. "mock" listings are illustrative only. */
  source: "mock" | "authorized_api";
}

/* ------------------------------------------------------------------ */
/* Participant requirements                                           */
/* ------------------------------------------------------------------ */

export interface Prioritized<T> {
  value: T;
  priority: Priority;
}

export interface Destination {
  /** Key into the known-places list, or "custom". */
  placeId: string;
  label: string;
  point: GeoPoint;
}

export interface RequirementProfile {
  /** Display name, e.g. "Riya". */
  name: string;
  avatarUrl?: string | null;

  work: Destination;
  /** Max acceptable one-way commute to work, minutes. */
  commute: Prioritized<number>;

  /** Optional second destination such as a gym or family home. */
  secondaryDestination?: Destination | null;
  secondaryCommute?: Prioritized<number> | null;

  /** Max monthly rent contribution (the person's share), INR. */
  maxRent: Prioritized<number>;
  /** Optional preferred (lower) contribution. */
  preferredRent?: Prioritized<number> | null;
  /** Whether the person wants utilities included in rent. */
  utilitiesIncluded: Prioritized<boolean>;

  /** Preferred areas get full credit, acceptable areas get partial credit. */
  areas: Prioritized<{ preferred: string[]; acceptable: string[] }>;
  /** Excluded areas. Default priority is DEALBREAKER. */
  excludedAreas: Prioritized<string[]>;

  bedrooms: Prioritized<number>;
  bathrooms: Prioritized<number>;
  /** Lift needed if the flat is above `aboveFloor` (0 = always needed). */
  lift: Prioritized<{ required: boolean; aboveFloor: number }>;
  parking: Prioritized<ParkingType>;
  furnishing: Prioritized<Furnishing[]>;
  petFriendly: Prioritized<boolean>;
  balcony: Prioritized<boolean>;
  floor: Prioritized<{ min: number | null; max: number | null }>;

  /** Other must-haves / preferences chosen from a fixed amenity list. */
  amenities: { amenity: Amenity; priority: Priority }[];

  /** Free-text notes. Never scored; shown to the group for discussion. */
  notes?: string;
}

export interface Participant {
  id: string;
  profile: RequirementProfile;
}

/* ------------------------------------------------------------------ */
/* Engine output                                                      */
/* ------------------------------------------------------------------ */

export type RequirementKey =
  | "budget"
  | "preferred_rent"
  | "utilities"
  | "commute"
  | "secondary_commute"
  | "areas"
  | "excluded_areas"
  | "bedrooms"
  | "bathrooms"
  | "lift"
  | "parking"
  | "furnishing"
  | "pet_friendly"
  | "balcony"
  | "floor"
  | `amenity:${Amenity}`;

export type RequirementStatus = "met" | "partial" | "unmet";

export interface RequirementResult {
  key: RequirementKey;
  label: string;
  priority: Priority;
  status: RequirementStatus;
  /** 0..1 satisfaction. */
  satisfaction: number;
  /** Human-readable detail, e.g. "38 min (mock estimate) vs 20 min target". */
  detail: string;
  /** Weight used in scoring (0 for dealbreakers, which are gates). */
  weight: number;
}

export interface ParticipantResult {
  participantId: string;
  name: string;
  /** 0..100 */
  fitScore: number;
  rentShare: number;
  mustHavesTotal: number;
  mustHavesMet: number;
  dealbreakersPassed: boolean;
  dealbreakerViolations: RequirementResult[];
  gets: RequirementResult[];
  compromises: RequirementResult[];
  severeCompromises: RequirementResult[];
  results: RequirementResult[];
  commuteMinutes: number | null;
}

export interface SharedItem {
  key: RequirementKey;
  label: string;
  /** Names of the people who care about this and have it satisfied. */
  people: string[];
}

export interface ListingEvaluation {
  property: Property;
  viable: boolean;
  /** 0..100. Only meaningful for viable listings. */
  groupScore: number;
  participants: ParticipantResult[];
  satisfiedByEveryone: SharedItem[];
  individualBenefits: SharedItem[];
  compromises: { name: string; item: RequirementResult }[];
  severeCompromises: { name: string; item: RequirementResult }[];
  dealbreakerViolations: { name: string; item: RequirementResult }[];
  discussionPoints: string[];
  shortlistReason: string;
  commuteIsEstimate: boolean;
}

export interface MatchRun {
  generatedAt: string;
  totalListings: number;
  shortlist: ListingEvaluation[];
  borderline: ListingEvaluation[];
  rejected: ListingEvaluation[];
  weights: Record<Priority, number>;
  providerName: string;
  locationProviderName: string;
}
