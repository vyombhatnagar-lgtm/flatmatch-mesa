import type { RequirementProfile } from "@/lib/matching/types";

export function defaultProfile(name: string): RequirementProfile {
  return {
    name,
    avatarUrl: null,
    work: { placeId: "", label: "", point: { lat: 0, lng: 0 } },
    commute: { value: 30, priority: "STRONG_PREFERENCE" },
    secondaryDestination: null,
    secondaryCommute: null,
    maxRent: { value: 15000, priority: "MUST_HAVE" },
    preferredRent: null,
    utilitiesIncluded: { value: false, priority: "NICE_TO_HAVE" },
    areas: { value: { preferred: [], acceptable: [] }, priority: "STRONG_PREFERENCE" },
    excludedAreas: { value: [], priority: "DEALBREAKER" },
    bedrooms: { value: 3, priority: "DEALBREAKER" },
    bathrooms: { value: 2, priority: "STRONG_PREFERENCE" },
    lift: { value: { required: false, aboveFloor: 2 }, priority: "MUST_HAVE" },
    parking: { value: "none", priority: "STRONG_PREFERENCE" },
    furnishing: { value: [], priority: "NICE_TO_HAVE" },
    petFriendly: { value: false, priority: "MUST_HAVE" },
    balcony: { value: false, priority: "NICE_TO_HAVE" },
    floor: { value: { min: null, max: null }, priority: "NICE_TO_HAVE" },
    amenities: [],
    notes: "",
  };
}
