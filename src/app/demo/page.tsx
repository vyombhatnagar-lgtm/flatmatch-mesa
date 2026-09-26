import Link from "next/link";
import { ResultsView } from "@/components/results/results-view";
import { Avatar, Card, Notice, personColor } from "@/components/ui";
import { DEMO_PARTICIPANTS } from "@/lib/demo/profiles";
import { getDemoResults } from "@/lib/demo/results";
import { inr } from "@/lib/format";
import { PRIORITY_LABELS } from "@/lib/matching/config";
import { AMENITY_LABELS } from "@/lib/matching/engine";

export const metadata = { title: "Demo: Riya, Meera & Kavita" };
export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const data = await getDemoResults();
  return (
    <div className="space-y-10">
      <Notice tone="accent" title="This is a demo with fictional people and mock listings">
        Riya, Meera and Kavita come from the MESA case. Nothing here is saved. <Link href="/groups/new" className="font-medium underline">Start your own search</Link> to use real accounts.
      </Notice>
      <section aria-labelledby="who">
        <h2 id="who" className="mb-4 font-display text-2xl">Their requirements, entered separately</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {DEMO_PARTICIPANTS.map(({ profile: p }, i) => (
            <Card key={p.name} className="p-5 text-sm">
              <div className="mb-3 flex items-center gap-2">
                <Avatar name={p.name} index={i} />
                <p className="font-semibold" style={{ color: personColor(i) }}>{p.name}</p>
              </div>
              <ul className="space-y-1 text-ink-2">
                <li>Works at {p.work.label}. Commute ≤ {p.commute.value} min <span className="text-ink-3">({PRIORITY_LABELS[p.commute.priority]})</span></li>
                <li>Pays up to {inr(p.maxRent.value)} <span className="text-ink-3">({PRIORITY_LABELS[p.maxRent.priority]})</span></li>
                {p.lift.value.required && <li>Lift above floor {p.lift.value.aboveFloor} <span className="text-ink-3">({PRIORITY_LABELS[p.lift.priority]})</span></li>}
                {p.petFriendly.value && <li>Pet friendly <span className="text-ink-3">({PRIORITY_LABELS[p.petFriendly.priority]})</span></li>}
                {p.parking.value !== "none" && <li>{p.parking.value === "car" ? "Car" : "Two-wheeler"} parking <span className="text-ink-3">({PRIORITY_LABELS[p.parking.priority]})</span></li>}
                {p.excludedAreas.value.length > 0 && <li>Won&apos;t live in {p.excludedAreas.value.join(", ")} <span className="text-ink-3">({PRIORITY_LABELS[p.excludedAreas.priority]})</span></li>}
                {p.amenities.filter((a) => a.priority === "MUST_HAVE").map((a) => <li key={a.amenity}>{AMENITY_LABELS[a.amenity]} <span className="text-ink-3">(Must have)</span></li>)}
                <li>{p.bedrooms.value} bedrooms <span className="text-ink-3">({PRIORITY_LABELS[p.bedrooms.priority]})</span></li>
              </ul>
              {p.notes && <p className="mt-3 border-t border-line pt-3 text-xs text-ink-3">“{p.notes}”</p>}
            </Card>
          ))}
        </div>
      </section>
      <ResultsView data={data} />
    </div>
  );
}
