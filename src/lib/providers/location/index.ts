import type { GeoPoint } from "@/lib/matching/types";

export interface CommuteEstimate {
  minutes: number;
  distanceKm: number;
  /** True when the value is an approximation, not a live routing result. */
  isEstimate: boolean;
  method: string;
}

/**
 * LocationProvider abstraction. The MVP ships only an approximate,
 * distance-based estimator. A future GoogleMapsLocationProvider or
 * MapboxLocationProvider can implement the same interface with live
 * directions data.
 */
export interface LocationProvider {
  readonly name: string;
  readonly isLive: boolean;
  estimateCommute(from: GeoPoint, to: GeoPoint): CommuteEstimate;
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * MOCK commute estimator.
 * Straight-line distance × road-winding factor ÷ average Pune peak-hour speed,
 * plus a fixed overhead for getting in/out. This is NOT live traffic data.
 */
export class ApproximateLocationProvider implements LocationProvider {
  readonly name = "Approximate distance model (mock)";
  readonly isLive = false;

  constructor(
    private readonly roadFactor = 1.35,
    private readonly avgSpeedKmh = 22,
    private readonly overheadMinutes = 6,
  ) {}

  estimateCommute(from: GeoPoint, to: GeoPoint): CommuteEstimate {
    const straight = haversineKm(from, to);
    const distanceKm = straight * this.roadFactor;
    const minutes = Math.round((distanceKm / this.avgSpeedKmh) * 60 + this.overheadMinutes);
    return {
      minutes,
      distanceKm: Math.round(distanceKm * 10) / 10,
      isEstimate: true,
      method: "straight-line distance × 1.35 at 22 km/h + 6 min",
    };
  }
}

export function getLocationProvider(): LocationProvider {
  // Future: if (process.env.MAPS_API_KEY) return new GoogleMapsLocationProvider(...)
  return new ApproximateLocationProvider();
}
