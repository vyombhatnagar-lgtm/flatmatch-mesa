import type { Property } from "@/lib/matching/types";
import { MOCK_PROPERTIES } from "./mock-data";

export interface ListingSearchCriteria {
  city?: string;
  /** Optional coarse pre-filters. The matching engine does the real evaluation. */
  minBedrooms?: number;
  maxRent?: number;
  localities?: string[];
}

/**
 * PropertyProvider abstraction.
 *
 * The UI and the matching engine only depend on this interface, never on a
 * concrete data source. The MVP ships MockPropertyProvider. A legitimate,
 * authorized listings API can be added by implementing this interface.
 */
export interface PropertyProvider {
  readonly name: string;
  /** True only for mock/illustrative data. Surfaced in the UI. */
  readonly isMock: boolean;
  searchListings(criteria?: ListingSearchCriteria): Promise<Property[]>;
  getListing(id: string): Promise<Property | null>;
}

export class PropertyProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PropertyProviderUnavailableError";
  }
}

export class MockPropertyProvider implements PropertyProvider {
  readonly name = "Mock Pune listings";
  readonly isMock = true;

  constructor(private readonly listings: Property[] = MOCK_PROPERTIES) {}

  async searchListings(criteria: ListingSearchCriteria = {}): Promise<Property[]> {
    return this.listings.filter((p) => {
      if (criteria.city && p.city.toLowerCase() !== criteria.city.toLowerCase()) return false;
      if (criteria.minBedrooms && p.bedrooms < criteria.minBedrooms) return false;
      if (criteria.maxRent && p.rent > criteria.maxRent) return false;
      if (criteria.localities?.length && !criteria.localities.includes(p.locality)) return false;
      return true;
    });
  }

  async getListing(id: string): Promise<Property | null> {
    return this.listings.find((p) => p.id === id) ?? null;
  }
}

/**
 * Placeholder for a future authorized listings API (a licensed data partner).
 * FlatMatch must never scrape 99acres, MagicBricks or similar sites.
 * Until PROPERTY_API_URL and PROPERTY_API_KEY are configured, it throws.
 */
export class AuthorizedPropertyApiProvider implements PropertyProvider {
  readonly name = "Authorized property API";
  readonly isMock = false;

  constructor(
    private readonly baseUrl: string | undefined = process.env.PROPERTY_API_URL,
    private readonly apiKey: string | undefined = process.env.PROPERTY_API_KEY,
  ) {}

  private assertConfigured() {
    if (!this.baseUrl || !this.apiKey) {
      throw new PropertyProviderUnavailableError(
        "Authorized property API is not configured (PROPERTY_API_URL / PROPERTY_API_KEY missing).",
      );
    }
  }

  async searchListings(): Promise<Property[]> {
    this.assertConfigured();
    // Map the partner's response to Property[] here once a partner is chosen.
    throw new PropertyProviderUnavailableError("Authorized property API integration not implemented yet.");
  }

  async getListing(): Promise<Property | null> {
    this.assertConfigured();
    throw new PropertyProviderUnavailableError("Authorized property API integration not implemented yet.");
  }
}

export function getPropertyProvider(): PropertyProvider {
  if (process.env.PROPERTY_PROVIDER === "authorized_api") {
    return new AuthorizedPropertyApiProvider();
  }
  return new MockPropertyProvider();
}
