import { inr, listJoin } from "@/lib/format";
import type { ListingEvaluation } from "@/lib/matching/types";
import type { Explanation } from "./types";

/**
 * Rule-based explanation. Used whenever Gemini is not configured, fails,
 * times out, or returns something that fails validation.
 */
/** Lower-case only the first letter so place names keep their capitals. */
function lc(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function buildFallbackExplanation(ev: ListingEvaluation): Explanation {
  const p = ev.property;
  const shared = ev.satisfiedByEveryone.map((s) => lc(s.label));
  const summary =
    `${p.bedrooms}BHK in ${p.locality} at ${inr(p.rent)}/month (${inr(Math.round(p.rent / Math.max(1, ev.participants.length)))} each on an equal split). ` +
    (shared.length ? `Works for everyone on: ${listJoin(shared.slice(0, 4))}.` : "No requirement is satisfied for everyone who rated it.");

  const participants = ev.participants.map((pr) => {
    const gets = pr.gets.filter((g) => g.priority !== "DEALBREAKER").slice(0, 3).map((g) => lc(g.label));
    const comp = pr.compromises.slice(0, 2).map((c) => `${lc(c.label)} (${c.detail})`);
    let fit = `${pr.name} is at ${pr.fitScore}% fit`;
    fit += gets.length ? `, getting ${listJoin(gets)}` : "";
    fit += comp.length ? `. Gives up: ${listJoin(comp)}.` : ", with no compromises on rated requirements.";
    return { name: pr.name, fit };
  });

  const majorCompromises = [...ev.severeCompromises, ...ev.compromises.filter((c) => c.item.priority === "STRONG_PREFERENCE")]
    .slice(0, 5)
    .map((c) => `${c.name}: ${c.item.label} (${c.item.detail})${c.item.priority === "MUST_HAVE" ? " (a must-have)" : ""}`);

  return {
    summary,
    participants,
    majorCompromises,
    discussionPoints: ev.discussionPoints.slice(0, 5),
  };
}
