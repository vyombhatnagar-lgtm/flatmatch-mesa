import type { GeoPoint } from "@/lib/matching/types";

/**
 * Approximate coordinates of common Pune localities and work hubs.
 * Used for the requirement form dropdowns and the mock commute estimator.
 */
export interface KnownPlace {
  id: string;
  label: string;
  point: GeoPoint;
  kind: "work" | "area" | "both";
}

export const PUNE_PLACES: KnownPlace[] = [
  { id: "hinjewadi-ph1", label: "Hinjewadi Phase 1 (Rajiv Gandhi Infotech Park)", point: { lat: 18.5913, lng: 73.7389 }, kind: "work" },
  { id: "hinjewadi-ph3", label: "Hinjewadi Phase 3", point: { lat: 18.5793, lng: 73.6922 }, kind: "work" },
  { id: "baner-road", label: "Baner Road", point: { lat: 18.559, lng: 73.7868 }, kind: "both" },
  { id: "balewadi-high-street", label: "Balewadi High Street", point: { lat: 18.5705, lng: 73.7752 }, kind: "both" },
  { id: "aundh-its", label: "Aundh (ITI Road)", point: { lat: 18.5602, lng: 73.8074 }, kind: "both" },
  { id: "shivajinagar", label: "Shivajinagar", point: { lat: 18.5308, lng: 73.8475 }, kind: "work" },
  { id: "university-road", label: "Savitribai Phule Pune University", point: { lat: 18.5526, lng: 73.8245 }, kind: "work" },
  { id: "kothrud", label: "Kothrud", point: { lat: 18.5074, lng: 73.8077 }, kind: "both" },
  { id: "wakad", label: "Wakad", point: { lat: 18.5987, lng: 73.7688 }, kind: "both" },
  { id: "magarpatta", label: "Magarpatta City", point: { lat: 18.5146, lng: 73.9261 }, kind: "work" },
  { id: "kharadi-eon", label: "Kharadi (EON IT Park)", point: { lat: 18.5516, lng: 73.9476 }, kind: "work" },
  { id: "viman-nagar", label: "Viman Nagar", point: { lat: 18.5679, lng: 73.9143 }, kind: "both" },
  { id: "koregaon-park", label: "Koregaon Park", point: { lat: 18.5362, lng: 73.894 }, kind: "both" },
  { id: "pimple-saudagar", label: "Pimple Saudagar", point: { lat: 18.5987, lng: 73.7976 }, kind: "both" },
  { id: "deccan", label: "Deccan Gymkhana", point: { lat: 18.5167, lng: 73.8414 }, kind: "both" },
];

/** Localities that listings can be in. Used for area preference dropdowns. */
export const PUNE_LOCALITIES = [
  "Baner",
  "Balewadi",
  "Aundh",
  "Pashan",
  "Kothrud",
  "Hinjewadi",
  "Wakad",
  "Pimple Saudagar",
  "Pimple Nilakh",
  "Bavdhan",
  "Sus",
  "Shivajinagar",
  "Viman Nagar",
  "Kharadi",
] as const;

export function findPlace(id: string): KnownPlace | undefined {
  return PUNE_PLACES.find((p) => p.id === id);
}
