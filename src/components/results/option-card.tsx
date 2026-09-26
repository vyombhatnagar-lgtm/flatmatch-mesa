import Link from "next/link";
import { Avatar, Card, Meter, personColor } from "@/components/ui";
import type { ListingEvaluation, ParticipantResult } from "@/lib/matching/types";
import { DiscussPanel, type Agreement } from "./discuss-panel";
import { ExplanationSource, ListingImage, PropertyFacts, RentLine, StatusIcon } from "./bits";
import type { ResultOption } from "./types";

export function agreementsFor(ev: ListingEvaluation): Agreement[] {
  return ev.participants.flatMap((p) =>
    p.compromises.map((c) => ({
      person: p.name,
      text: `accepts ${c.label.charAt(0).toLowerCase() + c.label.slice(1)} not being fully met: ${c.detail}.`,
      severe: c.priority === "MUST_HAVE",
    })),
  );
}

function PersonBlock({ pr, index, fitText }: { pr: ParticipantResult; index: number; fitText?: string }) {
  // Dealbreakers are listed separately below, so lead with the trade-able wins.
  const ordered = [...pr.gets.filter((g) => g.priority !== "DEALBREAKER"), ...pr.gets.filter((g) => g.priority === "DEALBREAKER")];
  const gets = ordered.slice(0, 4);
  return (
    <div className="rounded-xl bg-surface-2 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Avatar name={pr.name} index={index} size={28} />
        <p className="font-semibold" style={{ color: personColor(index) }}>
          {pr.name}
        </p>
      </div>
      <Meter value={pr.fitScore} label={`${pr.name} fit`} color={personColor(index)} />
      {fitText && <p className="mt-2 text-sm text-ink-2">{fitText}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">Gets</p>
          <ul className="space-y-1">
            {gets.length === 0 && <li className="text-sm text-ink-3">Nothing rated</li>}
            {gets.map((g) => (
              <li key={g.key} className="flex gap-2 text-sm">
                <StatusIcon status="met" />
                <span>{g.label}</span>
              </li>
            ))}
            {pr.gets.length > gets.length && <li className="text-xs text-ink-3">+{pr.gets.length - gets.length} more</li>}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">Compromises</p>
          <ul className="space-y-1">
            {pr.compromises.length === 0 && <li className="text-sm text-ink-3">None</li>}
            {pr.compromises.map((c) => (
              <li key={c.key} className="flex gap-2 text-sm">
                <StatusIcon status={c.status} />
                <span>
                  {c.label}
                  <span className="block text-xs text-ink-3">
                    {c.detail}
                    {c.priority === "MUST_HAVE" && <span className="font-medium text-partial"> · must-have</span>}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function OptionCard({ option, letter, basePath }: { option: ResultOption; letter: string; basePath: string }) {
  const ev = option.evaluation;
  const p = ev.property;
  const ex = option.explanation?.explanation;
  const dealbreakersChecked = ev.participants.flatMap((pr) =>
    pr.results.filter((r) => r.priority === "DEALBREAKER").map((r) => ({ name: pr.name, r })),
  );
  const fitTextFor = (name: string) => ex?.participants.find((x) => x.name === name)?.fit;

  return (
    <Card className="overflow-hidden">
      <article aria-labelledby={`opt-${p.id}`}>
        <div className="grid md:grid-cols-[280px_1fr]">
          <ListingImage p={p} className="h-48 md:h-full" />
          <div className="space-y-3 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Option {letter}</p>
            <h2 id={`opt-${p.id}`} className="font-display text-2xl leading-tight">
              {p.title}
            </h2>
            <p className="text-sm text-ink-2">{p.location}</p>
            <RentLine p={p} people={ev.participants.length} />
            <PropertyFacts p={p} compact />
            <div className="pt-1">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">Group compatibility</p>
              <Meter value={ev.groupScore} label="Group compatibility" color="var(--accent)" />
            </div>
            {ex?.summary && <p className="text-sm text-ink-2">{ex.summary}</p>}
            <ExplanationSource ex={option.explanation} />
          </div>
        </div>

        <div className="space-y-6 border-t border-line p-5">
          <div className="grid gap-3 lg:grid-cols-3">
            {ev.participants.map((pr, i) => (
              <PersonBlock key={pr.participantId} pr={pr} index={i} fitText={fitTextFor(pr.name)} />
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Satisfied by everyone</h3>
              <ul className="space-y-1 text-sm">
                {ev.satisfiedByEveryone.length === 0 && <li className="text-ink-3">Nothing everyone rated is fully met.</li>}
                {ev.satisfiedByEveryone.map((s) => (
                  <li key={s.key} className="flex gap-2">
                    <StatusIcon status="met" /> {s.label}
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Compromises</h3>
              <ul className="space-y-1 text-sm">
                {ev.compromises.length === 0 && <li className="text-ink-3">None</li>}
                {(ex?.majorCompromises?.length ? ex.majorCompromises : ev.compromises.map((c) => `${c.name}: ${c.item.label} (${c.item.detail})`)).map(
                  (c, i) => (
                    <li key={i} className="text-ink-2">
                      {c}
                    </li>
                  ),
                )}
              </ul>
            </section>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Dealbreakers</h3>
              {dealbreakersChecked.length === 0 ? (
                <p className="text-sm text-ink-3">No one set a dealbreaker that applies here.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {dealbreakersChecked.map(({ name, r }) => (
                    <li key={name + r.key} className="flex gap-2">
                      <StatusIcon status="met" />
                      <span>
                        {name}: {r.label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Discussion points</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
              {(ex?.discussionPoints?.length ? ex.discussionPoints : ev.discussionPoints).map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </section>

          <p className="text-xs text-ink-3">Why it&apos;s on this list: {ev.shortlistReason}</p>

          <DiscussPanel agreements={agreementsFor(ev)} questions={[]} />

          <div className="flex flex-wrap gap-3">
            <Link className="text-sm font-medium text-accent underline underline-offset-2" href={`${basePath}/options/${p.id}`}>
              See every requirement for Option {letter}
            </Link>
          </div>
        </div>
      </article>
    </Card>
  );
}
