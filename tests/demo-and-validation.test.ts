import { describe, expect, it } from "vitest";
import { DEMO_PARTICIPANTS, KAVITA, MEERA, RIYA } from "@/lib/demo/profiles";
import { runMatching } from "@/lib/matching/engine";
import { MOCK_PROPERTIES } from "@/lib/providers/property/mock-data";
import { RequirementProfileSchema, toRequirementItems } from "@/lib/validation/requirements";

describe("demo scenario (Riya, Meera, Kavita)", () => {
  const run = runMatching(MOCK_PROPERTIES, DEMO_PARTICIPANTS, { providerName: "mock" });

  it("produces 3 shortlisted, some borderline and some rejected listings", () => {
    expect(run.shortlist).toHaveLength(3);
    expect(run.borderline.length).toBeGreaterThan(0);
    expect(run.rejected.length).toBeGreaterThanOrEqual(4);
  });

  it("eliminates the fifth-floor walk-up because of Meera's lift dealbreaker", () => {
    const walkup = run.rejected.find((e) => e.property.id === "pune-baner-mahalunge-walkup");
    expect(walkup).toBeDefined();
    expect(walkup!.dealbreakerViolations.map((d) => d.name)).toEqual(["Meera"]);
  });

  it("keeps the Baner flat viable despite Riya's longer commute, showing the compromise", () => {
    const baner = run.shortlist.find((e) => e.property.id === "pune-baner-silver-oak");
    expect(baner).toBeDefined();
    const riya = baner!.participants.find((p) => p.name === "Riya")!;
    expect(riya.compromises.some((c) => c.key === "commute")).toBe(true);
  });

  it("rejects non-pet-friendly flats because of Kavita's dealbreaker", () => {
    const ids = run.rejected.filter((e) => e.dealbreakerViolations.some((d) => d.name === "Kavita" && d.item.key === "pet_friendly")).map((e) => e.property.id);
    expect(ids).toContain("pune-hinjewadi-infinity");
  });

  it("shortlisted flats pass every dealbreaker for all three", () => {
    for (const ev of run.shortlist) expect(ev.participants.every((p) => p.dealbreakersPassed)).toBe(true);
  });
});

describe("requirement validation", () => {
  it("accepts the demo profiles", () => {
    for (const p of [RIYA, MEERA, KAVITA]) expect(RequirementProfileSchema.safeParse(p).success).toBe(true);
  });

  it("rejects a preferred rent above the maximum", () => {
    const bad = { ...MEERA, preferredRent: { value: 30000, priority: "NICE_TO_HAVE" } };
    expect(RequirementProfileSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an area that is both preferred and excluded", () => {
    const bad = { ...RIYA, excludedAreas: { value: ["Wakad"], priority: "DEALBREAKER" } };
    expect(RequirementProfileSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects unknown priorities and localities", () => {
    expect(RequirementProfileSchema.safeParse({ ...RIYA, commute: { value: 20, priority: "SUPER_IMPORTANT" } }).success).toBe(false);
    expect(RequirementProfileSchema.safeParse({ ...RIYA, excludedAreas: { value: ["Atlantis"], priority: "DEALBREAKER" } }).success).toBe(false);
  });

  it("flattens a profile into requirement items with valid keys", () => {
    const items = toRequirementItems(KAVITA);
    expect(items.every((i) => /^[a-z_]+(:[a-z0-9_]+)?$/.test(i.key))).toBe(true);
    expect(items.find((i) => i.key === "pet_friendly")?.priority).toBe("DEALBREAKER");
    expect(items.find((i) => i.key === "secondary_commute")).toBeDefined();
  });
});
