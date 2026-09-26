# FlatMatch

**See the trade-off before you fall in love with the apartment.**

FlatMatch helps three people looking for a shared flat each set their own hard constraints, preferences and dealbreakers, privately. It then checks every listing against all three, removes flats that break anyone's dealbreaker, and shows 2–3 workable options with exactly what each person gets and gives up.

FlatMatch **does not choose the flat**. It is a decision-support tool: scores come from fixed, transparent rules, the AI layer only writes explanations, and nothing is ever labelled "best", "winner" or "recommended".

> Built for the MESA AI-Native Track assessment (Riya, Meera and Kavita's four-month flat hunt in Pune).

- **Live app:** https://flatmatch-mesa.vercel.app
- **Demo without an account:** https://flatmatch-mesa.vercel.app/demo

---

## The problem

Riya, Meera and Kavita have searched for four months. Each judges listings against her own picture of the ideal flat, and they argue on WhatsApp *after* someone is already attached to a place:

- Riya rejected a Baner 3BHK because the commute was longer than she'd like.
- Meera rejected a Kothrud flat because it didn't suit Riya.
- Kavita found a flat with no lift; Meera can't manage a fifth floor without one.

What's missing is a shared, structured view of **whose constraint is hard, whose is a preference, and what each option costs each person**.

## How it works

1. **Coordinator creates a search** and gets two single-use invite links.
2. **Each person fills in their requirements independently.** Row Level Security keeps answers private to their author until all three have submitted and the analysis has run.
3. For every requirement, each person chooses a priority: `DEALBREAKER`, `MUST_HAVE`, `STRONG_PREFERENCE`, `NICE_TO_HAVE`, `NOT_IMPORTANT`.
4. The coordinator starts the comparison once all three have submitted.
5. The **deterministic matching engine** evaluates every listing.
6. **Gemini** (optional) turns the structured result into plain-language explanations. If Gemini is missing or fails, a rule-based explanation is used and labelled as such.
7. The group sees 3 options, a side-by-side comparison, full trade-off detail per option, and a "Discuss this option" checklist: *What would we need to agree to for this flat to work?*

## Matching engine

`src/lib/matching/engine.ts` is pure TypeScript with no I/O and no AI, so the same inputs always give the same output.

| Phase | What happens |
|---|---|
| 1. Dealbreaker filtering | Any unmet dealbreaker for any person removes the listing for everyone |
| 2. Must-have evaluation | Must-haves are counted per person; misses are flagged as **severe compromises** (not exclusions) |
| 3. Preference scoring | Each requirement gets a satisfaction of 0–1 (partial credit for e.g. slightly over budget or a longer commute) × its weight |
| 4. Individual fit | `Σ weight × satisfaction / Σ weight`, 0–100 per person |
| 5. Group fit | `0.6 × mean + 0.4 × min` of individual fits, so a flat can't score well by leaving one person behind. Individual scores are always shown too |

Weights and tolerances live in **one file**: `src/lib/matching/config.ts`

```ts
MUST_HAVE: 100, STRONG_PREFERENCE: 50, NICE_TO_HAVE: 20, NOT_IMPORTANT: 0  // DEALBREAKER = hard gate
```

Viable listings are ordered by fewest severe compromises, then group compatibility, then rent. The top 3 are shown; the rest appear under "Also viable, with more compromises", and removed listings are listed with the exact dealbreaker that removed them.

**Fairness rule:** one person's preferences can never override another's dealbreaker. A dealbreaker violation always removes the flat. A preference miss keeps the flat and shows the compromise.

## Architecture

```
Next.js (App Router, TypeScript, Tailwind)
│
├── UI (server components + small client islands)
│     landing · auth · create search · invite · 6-step requirements form
│     group status · processing · results · comparison · trade-off detail · /demo
│
├── Server actions / route handler (run as the signed-in user, anon key + session cookie)
│     createGroup · acceptInvite · saveRequirements · POST /api/groups/[id]/analyze
│
├── Domain (pure TS, unit-tested)
│     matching/engine.ts      deterministic scoring
│     matching/config.ts      weights
│     validation/             zod schemas (server-side validation of every input)
│
├── Providers (interfaces, swappable)
│     PropertyProvider  → MockPropertyProvider (18 mock Pune listings)
│                       → AuthorizedPropertyApiProvider (placeholder, throws until configured)
│     LocationProvider  → ApproximateLocationProvider (distance-based, labelled "estimate")
│
├── Explanation layer (server only)
│     explain/gemini.ts   Gemini JSON-schema output, zod-validated, timeout,
│                         rejects "recommend/best" wording, falls back to rules
│     explain/fallback.ts rule-based explanations
│
└── Supabase (Postgres + Auth + RLS)
      profiles · search_groups · group_members · invitations
      participant_requirements · requirement_items
      property_listings · match_results · match_explanations
```

### Security model

- **No service-role key anywhere.** Every query runs as the signed-in user under RLS. Privileged steps are small `SECURITY DEFINER` RPCs that check membership and role themselves (`create_search_group`, `accept_invitation`, `get_group_progress`, `get_group_requirements_for_analysis`, `save_match_run`, `reopen_group`).
- RLS is enabled on every table. Users only see groups they belong to; only the coordinator sees invite tokens; requirements are private to their author until analysis; results and group membership can't be written directly.
- `GEMINI_API_KEY` is only read in server modules (`import "server-only"`).
- All inputs are validated with zod on the server; the DB adds check constraints and enum types.
- No `dangerouslySetInnerHTML`. Redirect targets are restricted to relative paths.
- `supabase/tests/rls_test.sql` checks 20+ access rules, including that outsiders can't read groups, participants can't read each other's answers before analysis, used invites can't be reused, and results can't be forged. It runs inside a transaction and rolls back.

## Tech stack

Next.js 15 · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Postgres, Auth, RLS) · `@supabase/ssr` · Google Gemini (`@google/genai`) · zod · Vitest · Vercel

UI primitives are hand-written in the shadcn/ui style (`src/components/ui`) instead of pulling the whole library in.

## Local setup

```bash
git clone https://github.com/vyombhatnagar-lgtm/flatmatch-mesa.git
cd flatmatch-mesa
npm install
cp .env.example .env.local   # fill in values (see below)
npm run dev                  # http://localhost:3000
```

The `/demo` route works with **no environment variables at all**. Without Supabase, account pages say plainly that saving is switched off.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit tests (engine, explanations, providers, validation, demo scenario) |
| `npm run test:db` | Applies migrations + seed to a local Postgres and runs the RLS suite (`PGHOST`, `PGPORT`, `PGUSER` env) |
| `npm run db:seed:generate` | Regenerates `supabase/seed.sql` from the mock listings |
| `npm run db:push` | `supabase db push` to the linked project |

## Environment variables

| Variable | Where | Required | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | yes (for accounts) | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | yes (for accounts) | Anon/publishable key. Public by design; RLS protects data |
| `GEMINI_API_KEY` | **server only** | no | Without it, explanations are rule-based and labelled so |
| `GEMINI_MODEL` | server only | no | Defaults to `gemini-3.8-flash` |
| `PROPERTY_PROVIDER` | server only | no | `mock` (default) or `authorized_api` |
| `PROPERTY_API_URL`, `PROPERTY_API_KEY` | server only | no | For a future licensed listings partner |

`SUPABASE_SERVICE_ROLE_KEY` is **not used** and must never be added to the client.

## Supabase setup

All schema lives in `supabase/migrations/`; the seed is `supabase/seed.sql`.

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push                       # applies migrations
psql "$DATABASE_URL" -f supabase/seed.sql  # loads the mock listings
psql "$DATABASE_URL" -f supabase/tests/rls_test.sql   # prints ALL RLS CHECKS PASSED
```

For local development with Docker: `npx supabase start && npx supabase db reset` (applies migrations and the seed).

Auth: email + password. For the demo project, **Confirm email** is turned off (Authentication → Sign In / Providers → Email) so test accounts work without an inbox. Set **Site URL** to your deployed URL.

## Gemini setup

1. Create a key at https://aistudio.google.com/apikey
2. Add `GEMINI_API_KEY` to `.env.local` and to Vercel (Production + Preview), as a server-only variable (no `NEXT_PUBLIC_` prefix).

Gemini receives only the structured evaluation (property facts, per-person met/unmet requirements, scores) and is asked: *"Explain how this listing fits each participant and what trade-offs the group would need to discuss."* It is never asked which flat to choose. Output must match a JSON schema, is validated with zod, and is discarded if it uses recommendation language.

## Deployment (Vercel)

1. Import the GitHub repo in Vercel (framework: Next.js; defaults are fine).
2. Add the environment variables above for **Production**, **Preview** and **Development**.
3. Deploy. Every push to a branch creates a Preview deployment; `main` deploys to Production.
4. In Supabase → Authentication → URL Configuration, set the Site URL to the production URL.

## Known limitations

- **Listings are mock data.** 18 fictional Pune listings (`src/lib/providers/property/mock-data.ts`), clearly labelled in the UI. No scraping. `AuthorizedPropertyApiProvider` is a stub for a licensed partner.
- **Commute times are estimates**: straight-line distance × 1.35 at 22 km/h + 6 min. Labelled "estimate" everywhere. `LocationProvider` is ready for Google Maps or Mapbox.
- Exactly 3 members per group; rent is assumed to be split equally (unequal splits are raised as a discussion point instead).
- Invites are shareable links; FlatMatch does not send emails.
- Profile images are optional https links (no uploads/Storage in the MVP).
- "Discuss this option" checkboxes are saved in the browser only, not shared.
- Free-text notes are shown to the group but never scored.
- Areas and work locations come from a fixed Pune list.

## Project structure

```
src/app/                 routes (pages, server actions, API route)
src/components/          ui primitives, form, group, results
src/lib/matching/        engine, config, types
src/lib/explain/         Gemini + fallback
src/lib/providers/       property + location providers, mock data
src/lib/supabase/        browser/server clients, middleware
src/lib/demo/            Riya/Meera/Kavita scenario
supabase/migrations/     schema, RLS, RPCs
supabase/seed.sql        generated mock listings
supabase/tests/          RLS test suite (+ local shim for plain Postgres)
tests/                   Vitest unit tests
```
