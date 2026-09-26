import { describe, expect, it } from "vitest";
import { MATCHING_CONFIG, PRIORITY_WEIGHTS } from "@/lib/matching/config";
import { computeGroupScore, evaluateListing, evaluateParticipant, runMatching } from "@/lib/matching/engine";
import { fixedCommute, participant, property } from "./helpers";

describe("1. dealbreaker violation", () => {
  it("removes a listing when any participant's dealbreaker fails", () => {
    const meera = participant("Meera", { lift: { value: { required: true, aboveFloor: 2 }, priority: "DEALBREAKER" } });
    const others = [participant("Riya"), participant("Kavita")];
    const walkUp = property({ id: "walkup", floor: 5, totalFloors: 5, lift: false });
    const ev = evaluateListing(walkUp, [others[0], meera, others[1]], fixedCommute(10));
    expect(ev.viable).toBe(false);
    expect(ev.dealbreakerViolations).toHaveLength(1);
    expect(ev.dealbreakerViolations[0].name).toBe("Meera");
    expect(ev.dealbreakerViolations[0].item.key).toBe("lift");
    expect(ev.shortlistReason).toMatch(/Removed/);
  });

  it("keeps a no-lift flat when it is within the floor limit", () => {
    const meera = participant("Meera", { lift: { value: { required: true, aboveFloor: 2 }, priority: "DEALBREAKER" } });
    const ev = evaluateListing(property({ floor: 2, lift: false }), [meera], fixedCommute(10));
    expect(ev.viable).toBe(true);
  });

  it("never shortlists a listing that breaks a dealbreaker, however well it scores otherwise", () => {
    const kavita = participant("Kavita", { petFriendly: { value: true, priority: "DEALBREAKER" } });
    const run = runMatching([property({ id: "nopets", petFriendly: false, rent: 1000 }), property({ id: "pets" })], [kavita], {
      locationProvider: fixedCommute(5),
    });
    expect(run.shortlist.map((e) => e.property.id)).toEqual(["pets"]);
    expect(run.rejected.map((e) => e.property.id)).toEqual(["nopets"]);
  });
});

describe("2. must-have satisfaction", () => {
  it("counts must-haves met and flags misses as severe compromises (not exclusions)", () => {
    const kavita = participant("Kavita", {
      parking: { value: "car", priority: "MUST_HAVE" },
      balcony: { value: true, priority: "MUST_HAVE" },
    });
    const pr = evaluateParticipant(kavita, property({ parking: "two-wheeler", balcony: true }), 3, fixedCommute(10));
    expect(pr.mustHavesTotal).toBe(2);
    expect(pr.mustHavesMet).toBe(1);
    expect(pr.severeCompromises.map((c) => c.key)).toEqual(["parking"]);
    expect(pr.dealbreakersPassed).toBe(true);
  });

  it("gives partial credit when the rent share is slightly over budget", () => {
    const meera = participant("Meera", { maxRent: { value: 16000, priority: "MUST_HAVE" } });
    const pr = evaluateParticipant(meera, property({ rent: 51000 }), 3, fixedCommute(10)); // 17,000 share
    const budget = pr.results.find((r) => r.key === "budget")!;
    expect(budget.status).toBe("partial");
    expect(budget.satisfaction).toBeCloseTo(1 - 0.0625 / MATCHING_CONFIG.budgetTolerance, 3);
  });
});

describe("3. preference scoring", () => {
  it("weights strong preferences above nice-to-haves", () => {
    const strong = participant("A", { balcony: { value: true, priority: "STRONG_PREFERENCE" }, petFriendly: { value: true, priority: "NICE_TO_HAVE" } });
    const noBalcony = evaluateParticipant(strong, property({ balcony: false, petFriendly: true }), 3, fixedCommute(10));
    const noPets = evaluateParticipant(strong, property({ balcony: true, petFriendly: false }), 3, fixedCommute(10));
    // Missing the strong preference hurts more than missing the nice-to-have.
    expect(noBalcony.fitScore).toBeLessThan(noPets.fitScore);
    const w = PRIORITY_WEIGHTS;
    expect(noBalcony.fitScore).toBe(Math.round((w.NICE_TO_HAVE / (w.STRONG_PREFERENCE + w.NICE_TO_HAVE)) * 100));
    expect(noPets.fitScore).toBe(Math.round((w.STRONG_PREFERENCE / (w.STRONG_PREFERENCE + w.NICE_TO_HAVE)) * 100));
  });

  it("keeps a long commute viable when it is only a preference, and shows the compromise", () => {
    const riya = participant("Riya", { commute: { value: 20, priority: "STRONG_PREFERENCE" } });
    const ev = evaluateListing(property(), [riya], fixedCommute(35));
    expect(ev.viable).toBe(true);
    const c = ev.participants[0].compromises.find((x) => x.key === "commute")!;
    expect(c.status).toBe("partial");
    expect(c.detail).toContain("35 min");
    expect(c.detail).toContain("estimate");
  });

  it("removes the same listing when the commute is a dealbreaker", () => {
    const riya = participant("Riya", { commute: { value: 20, priority: "DEALBREAKER" } });
    expect(evaluateListing(property(), [riya], fixedCommute(35)).viable).toBe(false);
  });

  it("ignores NOT_IMPORTANT requirements entirely", () => {
    const pr = evaluateParticipant(participant("A"), property({ petFriendly: false, lift: false }), 3, fixedCommute(90));
    expect(pr.results).toHaveLength(0);
    expect(pr.fitScore).toBe(100);
  });
});

describe("4. individual scores", () => {
  it("computes a 0–100 weighted fit per person", () => {
    const a = participant("A", {
      maxRent: { value: 15000, priority: "MUST_HAVE" }, // met (15,000 share)
      balcony: { value: true, priority: "STRONG_PREFERENCE" }, // unmet
      amenities: [{ amenity: "gym", priority: "NICE_TO_HAVE" }], // unmet
    });
    const pr = evaluateParticipant(a, property({ rent: 45000, balcony: false, amenities: [] }), 3, fixedCommute(10));
    expect(pr.fitScore).toBe(Math.round((100 / (100 + 50 + 20)) * 100));
    expect(pr.rentShare).toBe(15000);
    expect(pr.gets.map((g) => g.key)).toEqual(["budget"]);
    expect(pr.compromises.map((c) => c.key)).toEqual(["balcony", "amenity:gym"]);
  });
});

describe("5. group scores", () => {
  it("blends mean and minimum so one person can't be left behind", () => {
    expect(computeGroupScore([100, 100, 100])).toBe(100);
    const lopsided = computeGroupScore([100, 100, 40]);
    const balanced = computeGroupScore([80, 80, 80]);
    expect(lopsided).toBe(Math.round(80 * 0.6 + 40 * 0.4));
    expect(balanced).toBeGreaterThan(lopsided);
    expect(computeGroupScore([])).toBe(0);
  });

  it("exposes individual scores alongside the group score", () => {
    const ev = evaluateListing(property(), [participant("A"), participant("B"), participant("C")], fixedCommute(10));
    expect(ev.participants.map((p) => p.fitScore)).toHaveLength(3);
    expect(typeof ev.groupScore).toBe("number");
  });
});

describe("6. three-person comparison", () => {
  const riya = participant("Riya", {
    commute: { value: 20, priority: "STRONG_PREFERENCE" },
    amenities: [{ amenity: "power_backup", priority: "MUST_HAVE" }],
  });
  const meera = participant("Meera", {
    lift: { value: { required: true, aboveFloor: 2 }, priority: "DEALBREAKER" },
    furnishing: { value: ["furnished"], priority: "STRONG_PREFERENCE" },
  });
  const kavita = participant("Kavita", {
    petFriendly: { value: true, priority: "DEALBREAKER" },
    parking: { value: "car", priority: "MUST_HAVE" },
  });
  const listings = [
    property({ id: "good" }),
    property({ id: "semi", furnishing: "semi-furnished" }),
    property({ id: "bike", parking: "two-wheeler" }),
    property({ id: "walkup", floor: 5, lift: false }),
    property({ id: "nopets", petFriendly: false }),
  ];
  const run = runMatching(listings, [riya, meera, kavita], { locationProvider: fixedCommute(15) });

  it("shortlists at most 3 viable listings and rejects dealbreaker violations", () => {
    expect(run.shortlist.length).toBeLessThanOrEqual(MATCHING_CONFIG.shortlistSize);
    expect(run.rejected.map((e) => e.property.id).sort()).toEqual(["nopets", "walkup"]);
  });

  it("orders listings with fewer severe compromises first", () => {
    expect(run.shortlist[0].property.id).toBe("good");
    expect(run.shortlist.map((e) => e.property.id).indexOf("bike")).toBeGreaterThan(run.shortlist.map((e) => e.property.id).indexOf("semi"));
  });

  it("explains who gets what and who compromises", () => {
    const semi = run.shortlist.find((e) => e.property.id === "semi")!;
    const m = semi.participants.find((p) => p.name === "Meera")!;
    expect(m.compromises[0].key).toBe("furnishing");
    expect(m.compromises[0].status).toBe("partial");
    expect(semi.discussionPoints.join(" ")).toContain("Meera");
    const bike = run.shortlist.find((e) => e.property.id === "bike")!;
    expect(bike.severeCompromises[0].name).toBe("Kavita");
  });

  it("is deterministic", () => {
    const again = runMatching(listings, [riya, meera, kavita], { locationProvider: fixedCommute(15), now: new Date(run.generatedAt) });
    expect(again).toEqual(run);
  });
});

describe("7. empty listings", () => {
  it("returns an empty run without throwing", () => {
    const run = runMatching([], [participant("A"), participant("B"), participant("C")]);
    expect(run.shortlist).toEqual([]);
    expect(run.rejected).toEqual([]);
    expect(run.totalListings).toBe(0);
  });

  it("refuses to run without participants", () => {
    expect(() => runMatching([property()], [])).toThrow(/participants/);
  });
});

describe("8. missing requirements", () => {
  it("skips optional requirements that were never set", () => {
    const p = participant("A", { preferredRent: null, secondaryDestination: null, secondaryCommute: null, amenities: [] });
    const pr = evaluateParticipant(p, property(), 3, fixedCommute(10));
    expect(pr.results.find((r) => r.key === "preferred_rent")).toBeUndefined();
    expect(pr.results.find((r) => r.key === "secondary_commute")).toBeUndefined();
  });

  it("treats empty area lists as no preference", () => {
    const p = participant("A", {
      areas: { value: { preferred: [], acceptable: [] }, priority: "MUST_HAVE" },
      excludedAreas: { value: [], priority: "DEALBREAKER" },
    });
    const ev = evaluateListing(property(), [p], fixedCommute(10));
    expect(ev.viable).toBe(true);
    expect(ev.participants[0].results).toHaveLength(0);
  });
});
