import Link from "next/link";
import { Avatar, Card, Meter, personColor } from "@/components/ui";
import { ExplanationSource, ListingImage, PriorityTag, PropertyFacts, RentLine, StatusIcon, DecisionFooter } from "./bits";
import { DiscussPanel } from "./discuss-panel";
import { agreementsFor } from "./option-card";
import type { ResultOption } from "./types";

export function OptionDetail({ option, letter, basePath }: { option: ResultOption; letter: string; basePath: string }) {
  const ev = option.evaluation;
  const p = ev.property;
  const ex = option.explanation?.explanation;
  return (
    <div className="space-y-8">
      <Link href={basePath} className="text-sm text-accent underline underline-offset-2">
        ← Back to all options
      </Link>
      <Card className="overflow-hidden">
        <div className="grid md:grid-cols-[320px_1fr]">
          <ListingImage p={p} className="h-56 md:h-full" />
          <div className="space-y-3 p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Option {letter} · trade-off detail</p>
            <h1 className="font-display text-3xl leading-tight">{p.title}</h1>
            <p className="text-ink-2">{p.location}</p>
            <RentLine p={p} people={ev.participants.length} />
            <PropertyFacts p={p} />
            <p className="text-sm text-ink-2">{p.description}</p>
            <p className="text-xs text-ink-3">
              {p.listingUrl ? (
                <a className="underline" href={p.listingUrl} target="_blank" rel="noopener noreferrer">
                  View original listing
                </a>
              ) : (
                "Mock listing: there is no real listing page to open."
              )}
            </p>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">Group compatibility</p>
              <Meter value={ev.groupScore} label="Group compatibility" color="var(--accent)" />
            </div>
          </div>
        </div>
      </Card>

      {ex && (
        <Card className="p-5">
          <h2 className="mb-2 font-semibold">In plain words</h2>
          <p className="text-ink-2">{ex.summary}</p>
          <ExplanationSource ex={option.explanation} />
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {ev.participants.map((pr, i) => (
          <Card key={pr.participantId} className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Avatar name={pr.name} index={i} />
              <div>
                <h2 className="font-semibold" style={{ color: personColor(i) }}>
                  {pr.name}
                </h2>
                <p className="text-xs text-ink-3">
                  Must-haves met: {pr.mustHavesMet}/{pr.mustHavesTotal}
                  {pr.commuteMinutes != null && ` · commute ~${pr.commuteMinutes} min (est.)`}
                </p>
              </div>
            </div>
            <Meter value={pr.fitScore} label={`${pr.name} fit`} color={personColor(i)} />
            {ex?.participants.find((x) => x.name === pr.name) && (
              <p className="mt-3 text-sm text-ink-2">{ex.participants.find((x) => x.name === pr.name)!.fit}</p>
            )}
            <table className="mt-4 w-full text-sm">
              <caption className="sr-only">{pr.name}&apos;s requirements for this flat</caption>
              <thead className="sr-only">
                <tr>
                  <th>Status</th>
                  <th>Requirement</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {pr.results.map((r) => (
                  <tr key={r.key} className="border-t border-line align-top">
                    <td className="py-2 pr-2">
                      <StatusIcon status={r.status} />
                    </td>
                    <td className="py-2 pr-2">
                      {r.label}
                      <span className="block text-xs text-ink-3">{r.detail}</span>
                    </td>
                    <td className="py-2 text-right">
                      <PriorityTag priority={r.priority} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
      </div>

      <DiscussPanel agreements={agreementsFor(ev)} questions={ex?.discussionPoints?.length ? ex.discussionPoints : ev.discussionPoints} />
      <DecisionFooter />
    </div>
  );
}
