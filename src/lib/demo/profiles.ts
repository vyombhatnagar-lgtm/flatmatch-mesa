import type { Participant, RequirementProfile } from "@/lib/matching/types";
import { findPlace } from "@/lib/providers/location/places";

function dest(id: string) {
  const p = findPlace(id);
  if (!p) throw new Error(`Unknown place ${id}`);
  return { placeId: p.id, label: p.label.replace(/ \(.*\)$/, ""), point: p.point };
}

/**
 * Demo scenario from the MESA assessment case: Riya, Meera and Kavita.
 * - Riya works in Hinjewadi and wants a ~20 min commute (strong preference, not a dealbreaker).
 * - Meera cannot do stairs above the 2nd floor: lift is a DEALBREAKER for her.
 * - Kavita has a dog: pet-friendly is a DEALBREAKER; she drives, so car parking is a must-have.
 */
export const RIYA: RequirementProfile = {
  name: "Riya",
  work: dest("hinjewadi-ph1"),
  commute: { value: 20, priority: "STRONG_PREFERENCE" },
  secondaryDestination: null,
  secondaryCommute: null,
  maxRent: { value: 18000, priority: "MUST_HAVE" },
  preferredRent: null,
  utilitiesIncluded: { value: false, priority: "NOT_IMPORTANT" },
  areas: {
    value: { preferred: ["Wakad", "Hinjewadi", "Balewadi"], acceptable: ["Baner", "Pimple Saudagar", "Pimple Nilakh", "Sus"] },
    priority: "STRONG_PREFERENCE",
  },
  excludedAreas: { value: ["Viman Nagar", "Kharadi"], priority: "DEALBREAKER" },
  bedrooms: { value: 3, priority: "DEALBREAKER" },
  bathrooms: { value: 2, priority: "STRONG_PREFERENCE" },
  lift: { value: { required: false, aboveFloor: 0 }, priority: "NOT_IMPORTANT" },
  parking: { value: "two-wheeler", priority: "NICE_TO_HAVE" },
  furnishing: { value: ["furnished", "semi-furnished"], priority: "NICE_TO_HAVE" },
  petFriendly: { value: false, priority: "NOT_IMPORTANT" },
  balcony: { value: true, priority: "NICE_TO_HAVE" },
  floor: { value: { min: null, max: null }, priority: "NOT_IMPORTANT" },
  amenities: [
    { amenity: "power_backup", priority: "MUST_HAVE" },
    { amenity: "gated_society", priority: "NICE_TO_HAVE" },
  ],
  notes: "Hybrid: in the Hinjewadi office 3 days a week. Power backup matters for WFH calls.",
};

export const MEERA: RequirementProfile = {
  name: "Meera",
  work: dest("university-road"),
  commute: { value: 40, priority: "MUST_HAVE" },
  secondaryDestination: null,
  secondaryCommute: null,
  maxRent: { value: 16000, priority: "MUST_HAVE" },
  preferredRent: { value: 14000, priority: "NICE_TO_HAVE" },
  utilitiesIncluded: { value: true, priority: "NICE_TO_HAVE" },
  areas: {
    value: { preferred: ["Aundh", "Baner", "Pashan"], acceptable: ["Balewadi", "Kothrud", "Wakad", "Pimple Nilakh", "Pimple Saudagar"] },
    priority: "NICE_TO_HAVE",
  },
  excludedAreas: { value: [], priority: "NOT_IMPORTANT" },
  bedrooms: { value: 3, priority: "DEALBREAKER" },
  bathrooms: { value: 2, priority: "MUST_HAVE" },
  lift: { value: { required: true, aboveFloor: 2 }, priority: "DEALBREAKER" },
  parking: { value: "none", priority: "NOT_IMPORTANT" },
  furnishing: { value: ["furnished"], priority: "STRONG_PREFERENCE" },
  petFriendly: { value: false, priority: "NOT_IMPORTANT" },
  balcony: { value: true, priority: "NICE_TO_HAVE" },
  floor: { value: { min: null, max: null }, priority: "NOT_IMPORTANT" },
  amenities: [
    { amenity: "water_24x7", priority: "MUST_HAVE" },
    { amenity: "security", priority: "STRONG_PREFERENCE" },
  ],
  notes: "Can't manage stairs above the 2nd floor. Happy to live with a dog.",
};

export const KAVITA: RequirementProfile = {
  name: "Kavita",
  work: dest("baner-road"),
  commute: { value: 30, priority: "NICE_TO_HAVE" },
  secondaryDestination: dest("kothrud"),
  secondaryCommute: { value: 40, priority: "NICE_TO_HAVE" },
  maxRent: { value: 20000, priority: "MUST_HAVE" },
  preferredRent: null,
  utilitiesIncluded: { value: false, priority: "NOT_IMPORTANT" },
  areas: {
    value: { preferred: ["Baner", "Balewadi", "Aundh"], acceptable: ["Wakad", "Pashan", "Bavdhan", "Pimple Nilakh"] },
    priority: "STRONG_PREFERENCE",
  },
  excludedAreas: { value: ["Hinjewadi"], priority: "MUST_HAVE" },
  bedrooms: { value: 3, priority: "DEALBREAKER" },
  bathrooms: { value: 2, priority: "NICE_TO_HAVE" },
  lift: { value: { required: false, aboveFloor: 0 }, priority: "NOT_IMPORTANT" },
  parking: { value: "car", priority: "MUST_HAVE" },
  furnishing: { value: [], priority: "NOT_IMPORTANT" },
  petFriendly: { value: true, priority: "DEALBREAKER" },
  balcony: { value: true, priority: "STRONG_PREFERENCE" },
  floor: { value: { min: null, max: null }, priority: "NOT_IMPORTANT" },
  amenities: [{ amenity: "gym", priority: "NICE_TO_HAVE" }],
  notes: "Moving in with Bruno (a beagle). Family lives in Kothrud; visits most weekends.",
};

export const DEMO_PARTICIPANTS: Participant[] = [
  { id: "demo-riya", profile: RIYA },
  { id: "demo-meera", profile: MEERA },
  { id: "demo-kavita", profile: KAVITA },
];
