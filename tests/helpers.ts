import type { Participant, Property, RequirementProfile } from "@/lib/matching/types";
import type { LocationProvider } from "@/lib/providers/location";

/** A location provider that returns a fixed commute, for predictable tests. */
export function fixedCommute(minutes: number): LocationProvider {
  return {
    name: "fixed (test)",
    isLive: false,
    estimateCommute: () => ({ minutes, distanceKm: 1, isEstimate: true, method: "fixed" }),
  };
}

export function property(overrides: Partial<Property> = {}): Property {
  return {
    id: "p1",
    title: "Test flat",
    location: "Somewhere, Baner",
    locality: "Baner",
    city: "Pune",
    rent: 45000,
    utilitiesIncluded: false,
    bedrooms: 3,
    bathrooms: 2,
    floor: 3,
    totalFloors: 8,
    lift: true,
    parking: "car",
    furnishing: "furnished",
    petFriendly: true,
    balcony: true,
    amenities: ["power_backup", "water_24x7"],
    latitude: 18.56,
    longitude: 73.78,
    listingUrl: null,
    imageUrl: "/listings/flat-1.svg",
    description: "test",
    source: "mock",
    ...overrides,
  };
}

/** A minimal profile where everything is NOT_IMPORTANT unless overridden. */
export function profile(name: string, overrides: Partial<RequirementProfile> = {}): RequirementProfile {
  return {
    name,
    work: { placeId: "baner-road", label: "Baner Road", point: { lat: 18.559, lng: 73.7868 } },
    commute: { value: 30, priority: "NOT_IMPORTANT" },
    maxRent: { value: 20000, priority: "NOT_IMPORTANT" },
    utilitiesIncluded: { value: false, priority: "NOT_IMPORTANT" },
    areas: { value: { preferred: [], acceptable: [] }, priority: "NOT_IMPORTANT" },
    excludedAreas: { value: [], priority: "NOT_IMPORTANT" },
    bedrooms: { value: 3, priority: "NOT_IMPORTANT" },
    bathrooms: { value: 2, priority: "NOT_IMPORTANT" },
    lift: { value: { required: false, aboveFloor: 0 }, priority: "NOT_IMPORTANT" },
    parking: { value: "none", priority: "NOT_IMPORTANT" },
    furnishing: { value: [], priority: "NOT_IMPORTANT" },
    petFriendly: { value: false, priority: "NOT_IMPORTANT" },
    balcony: { value: false, priority: "NOT_IMPORTANT" },
    floor: { value: { min: null, max: null }, priority: "NOT_IMPORTANT" },
    amenities: [],
    ...overrides,
  };
}

export function participant(name: string, overrides: Partial<RequirementProfile> = {}): Participant {
  return { id: name.toLowerCase(), profile: profile(name, overrides) };
}
