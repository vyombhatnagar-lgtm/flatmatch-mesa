/** Prints the demo scenario result to the terminal: npx tsx scripts/demo-run.ts */
import { runMatching } from "../src/lib/matching/engine";
import type { ListingEvaluation } from "../src/lib/matching/types";
import { MOCK_PROPERTIES } from "../src/lib/providers/property/mock-data";
import { DEMO_PARTICIPANTS } from "../src/lib/demo/profiles";

const r = runMatching(MOCK_PROPERTIES, DEMO_PARTICIPANTS, { providerName: "mock" });
const show = (e: ListingEvaluation) =>
  `${e.property.id.padEnd(32)} group=${e.groupScore} ` +
  e.participants.map((p) => `${p.name}=${p.fitScore}% (~${p.commuteMinutes}min)`).join(" ") +
  (e.severeCompromises.length ? `  severe: ${e.severeCompromises.map((s) => `${s.name}:${s.item.key}`).join(", ")}` : "");
console.log("SHORTLIST");
r.shortlist.forEach((e) => console.log(show(e)));
console.log("\nALSO VIABLE");
r.borderline.forEach((e) => console.log(show(e)));
console.log("\nREJECTED");
r.rejected.forEach((e) => console.log(`${e.property.id} -> ${e.shortlistReason}`));
