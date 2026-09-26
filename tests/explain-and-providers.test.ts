import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGeminiPrompt, explainListing } from "@/lib/explain/gemini";
import { evaluateListing } from "@/lib/matching/engine";
import {
  AuthorizedPropertyApiProvider,
  MockPropertyProvider,
  PropertyProviderUnavailableError,
  getPropertyProvider,
} from "@/lib/providers/property";
import { ApproximateLocationProvider } from "@/lib/providers/location";
import { fixedCommute, participant, property } from "./helpers";

const ev = evaluateListing(
  property(),
  [
    participant("Riya", { commute: { value: 20, priority: "STRONG_PREFERENCE" } }),
    participant("Meera"),
    participant("Kavita"),
  ],
  fixedCommute(35),
);

const validJson = JSON.stringify({
  summary: "A furnished 3BHK in Baner.",
  participants: [
    { name: "Riya", fit: "Riya would accept a longer commute (estimate)." },
    { name: "Meera", fit: "Meera has nothing to give up." },
    { name: "Kavita", fit: "Kavita has nothing to give up." },
  ],
  majorCompromises: ["Riya: commute"],
  discussionPoints: ["Would Riya accept ~35 minutes?"],
});

describe("9. Gemini unavailable", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("falls back to rule-based text when no API key is configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const res = await explainListing(ev);
    expect(res.source).toBe("fallback");
    expect(res.fallbackReason).toMatch(/not connected/);
    expect(res.explanation.participants.map((p) => p.name)).toEqual(["Riya", "Meera", "Kavita"]);
    expect(res.explanation.discussionPoints.length).toBeGreaterThan(0);
  });

  it("falls back when the Gemini call throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await explainListing(ev, { apiKey: "x", generate: async () => Promise.reject(new Error("503 unavailable")) });
    expect(res.source).toBe("fallback");
    spy.mockRestore();
  });

  it("retries once on a transient 503, then succeeds", async () => {
    let calls = 0;
    const res = await explainListing(ev, {
      apiKey: "x",
      generate: async () => {
        calls++;
        if (calls === 1) throw new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}');
        return validJson;
      },
    });
    expect(calls).toBe(2);
    expect(res.source).toBe("gemini");
  });

  it("falls back when Gemini times out", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await explainListing(ev, { apiKey: "x", timeoutMs: 20, generate: () => new Promise((r) => setTimeout(() => r(validJson), 200)) });
    expect(res.source).toBe("fallback");
    spy.mockRestore();
  });

  it("falls back on malformed JSON", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await explainListing(ev, { apiKey: "x", generate: async () => "not json" });
    expect(res.source).toBe("fallback");
    spy.mockRestore();
  });

  it("discards output that recommends a flat", async () => {
    const bad = validJson.replace("A furnished 3BHK in Baner.", "This is the best option, we recommend it.");
    const res = await explainListing(ev, { apiKey: "x", generate: async () => bad });
    expect(res.source).toBe("fallback");
    expect(res.fallbackReason).toMatch(/recommendation/);
  });

  it("uses Gemini output when it is valid", async () => {
    const res = await explainListing(ev, { apiKey: "x", model: "test-model", generate: async () => validJson });
    expect(res.source).toBe("gemini");
    expect(res.model).toBe("test-model");
  });

  it("asks Gemini to explain trade-offs, never to choose", () => {
    const prompt = buildGeminiPrompt(ev);
    expect(prompt).toContain("Explain how this listing fits each participant and what trade-offs the group would need to discuss.");
    expect(prompt).toMatch(/Never recommend/);
    expect(prompt).not.toMatch(/which flat should they choose/i);
  });
});

describe("10. property API unavailable", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("throws a typed error when the authorized API is not configured", async () => {
    const p = new AuthorizedPropertyApiProvider(undefined, undefined);
    await expect(p.searchListings()).rejects.toBeInstanceOf(PropertyProviderUnavailableError);
    await expect(p.getListing()).rejects.toBeInstanceOf(PropertyProviderUnavailableError);
  });

  it("uses the mock provider by default and labels it as mock", () => {
    vi.stubEnv("PROPERTY_PROVIDER", "");
    const p = getPropertyProvider();
    expect(p).toBeInstanceOf(MockPropertyProvider);
    expect(p.isMock).toBe(true);
  });

  it("selects the authorized provider only when explicitly configured", () => {
    vi.stubEnv("PROPERTY_PROVIDER", "authorized_api");
    expect(getPropertyProvider()).toBeInstanceOf(AuthorizedPropertyApiProvider);
  });

  it("mock provider has at least 15 Pune listings and supports lookups and filters", async () => {
    const p = new MockPropertyProvider();
    const all = await p.searchListings();
    expect(all.length).toBeGreaterThanOrEqual(15);
    expect(new Set(all.map((l) => l.id)).size).toBe(all.length);
    for (const loc of ["Baner", "Kothrud", "Hinjewadi", "Wakad", "Aundh", "Balewadi"]) {
      expect(all.some((l) => l.locality === loc)).toBe(true);
    }
    expect(await p.getListing(all[0].id)).toEqual(all[0]);
    expect(await p.getListing("nope")).toBeNull();
    expect((await p.searchListings({ minBedrooms: 3 })).every((l) => l.bedrooms >= 3)).toBe(true);
  });
});

describe("location provider", () => {
  it("labels its estimates as not live", () => {
    const loc = new ApproximateLocationProvider();
    const est = loc.estimateCommute({ lat: 18.5987, lng: 73.7688 }, { lat: 18.5913, lng: 73.7389 });
    expect(loc.isLive).toBe(false);
    expect(est.isEstimate).toBe(true);
    expect(est.minutes).toBeGreaterThan(5);
    expect(est.minutes).toBeLessThan(40);
  });
});
