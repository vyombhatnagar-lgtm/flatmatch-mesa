import Link from "next/link";
import { ButtonLink, Card, Notice, PageHeader } from "@/components/ui";
import { inr } from "@/lib/format";
import type { ListingEvaluation } from "@/lib/matching/types";
import { DataSourceBar, DecisionFooter } from "./bits";
import { OptionCard } from "./option-card";
import { OPTION_LETTERS, type ResultsData } from "./types";

function OtherListing({ ev, kind }: { ev: ListingEvaluation; kind: "borderline" | "rejected" }) {
  const p = ev.property;
  return (
    <li className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">
          {p.title} <span className="font-normal text-ink-3">· {p.locality}</span>
        </p>
        <p className="text-sm text-ink-2">{inr(p.rent)}/month</p>
      </div>
      {kind === "rejected" ? (
        <ul className="mt-2 space-y-1 text-sm">
          {ev.dealbreakerViolations.map((d, i) => (
            <li key={i} className="text-unmet">
              ✕ {d.name}&apos;s dealbreaker: {d.item.label} ({d.item.detail})
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-ink-2">
          Group compatibility {ev.groupScore}% · {ev.participants.map((pp) => `${pp.name} ${pp.fitScore}%`).join(" · ")}
          {ev.severeCompromises.length > 0 && (
            <span className="block text-partial">
              Misses a must-have: {ev.severeCompromises.map((s) => `${s.name}: ${s.item.label}`).join("; ")}
            </span>
          )}
        </p>
      )}
    </li>
  );
}

export function ResultsView({ data }: { data: ResultsData }) {
  const n = data.shortlist.length;
  return (
    <div>
      <PageHeader eyebrow={data.mode === "demo" ? "Demo · Riya, Meera & Kavita" : "Results"} title={data.title}>
        FlatMatch checked {data.meta.totalListings} listings against all three people&apos;s requirements.{" "}
        {data.rejected.length} were removed by someone&apos;s dealbreaker. {n > 0 ? `These ${n} passed every dealbreaker and miss the fewest must-haves.` : ""}
      </PageHeader>

      <div className="mb-6 space-y-3">
        <DataSourceBar meta={data.meta} />
        <p className="text-xs text-ink-3">
          Options are ordered by group compatibility with your current constraints. That order is not a recommendation.
        </p>
      </div>

      {n === 0 && (
        <Notice tone="partial" title="No listing passes everyone's dealbreakers">
          Look at the removed listings below to see which dealbreakers are blocking the most flats. Could any of them become a
          must-have instead?
        </Notice>
      )}
      {n === 1 && (
        <Notice tone="partial" className="mb-6">
          Only one listing passes every dealbreaker. The removed listings below show which constraints are the tightest.
        </Notice>
      )}

      {n > 1 && (
        <div className="mb-6 flex flex-wrap gap-3">
          <ButtonLink href={`${data.basePath}/compare`} variant="secondary">
            Compare side by side
          </ButtonLink>
        </div>
      )}

      <div className="space-y-8">
        {data.shortlist.map((o, i) => (
          <OptionCard key={o.evaluation.property.id} option={o} letter={OPTION_LETTERS[i]} basePath={data.basePath} />
        ))}
      </div>

      {data.borderline.length > 0 && (
        <section className="mt-12" aria-labelledby="borderline">
          <h2 id="borderline" className="mb-1 font-display text-2xl">
            Also viable, with more compromises
          </h2>
          <p className="mb-4 text-sm text-ink-2">These pass every dealbreaker but miss more must-haves or score lower for someone.</p>
          <ul className="grid gap-3 md:grid-cols-2">
            {data.borderline.map((ev) => (
              <OtherListing key={ev.property.id} ev={ev} kind="borderline" />
            ))}
          </ul>
        </section>
      )}

      {data.rejected.length > 0 && (
        <section className="mt-12" aria-labelledby="rejected">
          <h2 id="rejected" className="mb-1 font-display text-2xl">
            Removed by a dealbreaker
          </h2>
          <p className="mb-4 text-sm text-ink-2">A dealbreaker for one person removes the flat for the whole group.</p>
          <ul className="grid gap-3 md:grid-cols-2">
            {data.rejected.map((ev) => (
              <OtherListing key={ev.property.id} ev={ev} kind="rejected" />
            ))}
          </ul>
        </section>
      )}

      <Card className="mt-12 p-5 text-sm text-ink-2">
        <h2 className="mb-2 font-semibold text-ink">How these scores work</h2>
        <p>
          Dealbreakers are pass/fail. Everything else is weighted: must-have {data.meta.weights.MUST_HAVE}, strong preference{" "}
          {data.meta.weights.STRONG_PREFERENCE}, nice-to-have {data.meta.weights.NICE_TO_HAVE}. Each person&apos;s fit is the
          weighted share of their requirements met. Group compatibility is 60% the average fit and 40% the lowest fit, so a
          flat can&apos;t score well by leaving one person behind. The AI only writes explanations and never changes a score.
        </p>
        {data.mode === "demo" && (
          <p className="mt-2">
            Want to try it with your own flatmates? <Link href="/groups/new" className="font-medium text-accent underline">Start a search</Link>.
          </p>
        )}
      </Card>

      <DecisionFooter />
    </div>
  );
}
