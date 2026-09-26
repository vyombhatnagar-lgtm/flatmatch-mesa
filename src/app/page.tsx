import { ButtonLink, Card, Badge } from "@/components/ui";

const steps = [
  {
    n: "1",
    title: "Everyone answers alone",
    body: "Each flatmate sets a budget, commute, areas and dealbreakers privately, so nobody anchors on anyone else's picture of the ideal flat.",
  },
  {
    n: "2",
    title: "Rules check every listing",
    body: "Dealbreakers remove a flat for the whole group. Must-haves, strong preferences and nice-to-haves are weighted, and everyone gets their own score.",
  },
  {
    n: "3",
    title: "You see the trade-offs",
    body: "Two or three workable options, each showing what each person gets and what they give up. You make the decision together.",
  },
];

export default function Home() {
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <Badge tone="accent" className="mb-4">For 3 people sharing a flat</Badge>
          <h1 className="font-display text-4xl leading-[1.1] text-ink sm:text-5xl">
            See the trade-off before you fall in love with the apartment.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-2">
            FlatMatch compares listings against all three of you at once. It removes the flats that break someone&apos;s
            dealbreaker and shows exactly who compromises on what in the rest.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/groups/new">Start a search</ButtonLink>
            <ButtonLink href="/demo" variant="secondary">
              See the Riya, Meera &amp; Kavita demo
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-ink-3">FlatMatch does not choose your flat. It makes the trade-offs visible so your group can decide.</p>
        </div>

        <Card className="p-5 sm:p-6" aria-label="Example of a FlatMatch trade-off summary">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">3BHK · Pan Card Club Road, Baner</p>
              <p className="text-xs text-ink-3">₹48,000/month · floor 3 · lift · car parking</p>
            </div>
            <Badge>Example</Badge>
          </div>
          <ul className="space-y-3 text-sm">
            <li className="rounded-lg bg-surface-2 p-3">
              <p className="font-semibold" style={{ color: "var(--p1)" }}>Riya · 90% fit</p>
              <p className="text-ink-2">Gets power backup and 3 bedrooms. <span className="text-partial">Gives up: ~29 min commute (estimate) vs her 20 min target.</span></p>
            </li>
            <li className="rounded-lg bg-surface-2 p-3">
              <p className="font-semibold" style={{ color: "var(--p2)" }}>Meera · 93% fit</p>
              <p className="text-ink-2">Gets a lift, furnished rooms and 24x7 water. <span className="text-partial">Gives up: pays ₹16,000, above her preferred ₹14,000.</span></p>
            </li>
            <li className="rounded-lg bg-surface-2 p-3">
              <p className="font-semibold" style={{ color: "var(--p3)" }}>Kavita · 96% fit</p>
              <p className="text-ink-2">Gets a pet-friendly flat, car parking and a balcony for Bruno.</p>
            </li>
          </ul>
        </Card>
      </section>

      <section aria-labelledby="how">
        <h2 id="how" className="mb-6 font-display text-2xl">How it works</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n}>
              <Card className="h-full p-5">
                <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                  {s.n}
                </span>
                <h3 className="mb-1 font-semibold">{s.title}</h3>
                <p className="text-sm text-ink-2">{s.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-2 font-semibold">What FlatMatch does</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
            <li>Treats dealbreakers as hard limits for the whole group</li>
            <li>Weights must-haves, strong preferences and nice-to-haves differently</li>
            <li>Shows every person&apos;s fit next to the group score</li>
            <li>Lists the questions your group needs to settle for each option</li>
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="mb-2 font-semibold">What it deliberately doesn&apos;t do</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
            <li>Pick a flat, or label any option &ldquo;best&rdquo;</li>
            <li>Let AI decide anything. Scoring is fixed rules; AI only writes the explanations</li>
            <li>Scrape listing sites. This MVP uses clearly labelled mock Pune listings</li>
            <li>Claim live traffic. Commute times are distance-based estimates</li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
