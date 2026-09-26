"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { saveRequirements } from "@/app/actions";
import { Button, Card, Field, Notice, inputClass } from "@/components/ui";
import { inr } from "@/lib/format";
import { PRIORITY_HELP, PRIORITY_LABELS } from "@/lib/matching/config";
import { AMENITY_LABELS } from "@/lib/matching/engine";
import { AMENITIES, PRIORITIES, type Amenity, type Furnishing, type Priority, type RequirementProfile } from "@/lib/matching/types";
import { PUNE_LOCALITIES, PUNE_PLACES } from "@/lib/providers/location/places";

const STEPS = ["About you", "Budget", "Location", "The flat", "Priorities", "Review"] as const;
type AreaChoice = "preferred" | "acceptable" | "excluded" | "none";

function PrioritySelect({ value, onChange, label }: { value: Priority; onChange: (p: Priority) => void; label: string }) {
  const name = useId();
  return (
    <fieldset>
      <legend className="sr-only">Priority for {label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {PRIORITIES.map((p) => {
          const active = value === p;
          return (
            <label
              key={p}
              title={PRIORITY_HELP[p]}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? p === "DEALBREAKER"
                    ? "border-unmet bg-unmet-soft text-unmet"
                    : p === "MUST_HAVE"
                      ? "border-partial bg-partial-soft text-partial"
                      : "border-accent bg-accent-soft text-accent"
                  : "border-line text-ink-2 hover:bg-surface-2"
              }`}
            >
              <input type="radio" className="sr-only" name={name} checked={active} onChange={() => onChange(p)} />
              {PRIORITY_LABELS[p]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Choice<T extends string>({
  options,
  value,
  onChange,
  legend,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  legend: string;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={`min-h-[44px] cursor-pointer rounded-lg border px-3 py-2.5 text-sm ${
              value === o.value ? "border-accent bg-accent-soft font-medium text-accent" : "border-line hover:bg-surface-2"
            }`}
          >
            <input type="radio" className="sr-only" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function num(v: string, fallback: number): number {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function RequirementsForm({
  groupId,
  initial,
  submittedBefore,
}: {
  groupId: string;
  initial: RequirementProfile;
  submittedBefore: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [p, setP] = useState<RequirementProfile>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ tone: "unmet" | "accent"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof RequirementProfile>(k: K, v: RequirementProfile[K]) => setP((prev) => ({ ...prev, [k]: v }));

  const areaChoice = (loc: string): AreaChoice =>
    p.areas.value.preferred.includes(loc)
      ? "preferred"
      : p.areas.value.acceptable.includes(loc)
        ? "acceptable"
        : p.excludedAreas.value.includes(loc)
          ? "excluded"
          : "none";

  const setArea = (loc: string, c: AreaChoice) => {
    const without = (arr: string[]) => arr.filter((a) => a !== loc);
    setP((prev) => ({
      ...prev,
      areas: {
        ...prev.areas,
        value: {
          preferred: c === "preferred" ? [...without(prev.areas.value.preferred), loc] : without(prev.areas.value.preferred),
          acceptable: c === "acceptable" ? [...without(prev.areas.value.acceptable), loc] : without(prev.areas.value.acceptable),
        },
      },
      excludedAreas: {
        ...prev.excludedAreas,
        value: c === "excluded" ? [...without(prev.excludedAreas.value), loc] : without(prev.excludedAreas.value),
      },
    }));
  };

  const toggleAmenity = (a: Amenity, on: boolean) =>
    set("amenities", on ? [...p.amenities, { amenity: a, priority: "NICE_TO_HAVE" }] : p.amenities.filter((x) => x.amenity !== a));

  const toggleFurnishing = (f: Furnishing, on: boolean) =>
    set("furnishing", { ...p.furnishing, value: on ? [...p.furnishing.value, f] : p.furnishing.value.filter((x) => x !== f) });

  function validateStep(s: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!p.name.trim()) e.name = "Enter your name.";
      if (!p.work.placeId) e.work = "Choose where you work or study.";
      if (p.commute.value < 5 || p.commute.value > 180) e.commute = "Enter between 5 and 180 minutes.";
      if (p.avatarUrl && !/^https:\/\/\S+$/.test(p.avatarUrl)) e.avatarUrl = "Use an https:// image link, or leave it empty.";
    }
    if (s === 1) {
      if (p.maxRent.value < 1000) e.maxRent = "Enter your maximum monthly contribution.";
      if (p.preferredRent && p.preferredRent.value > p.maxRent.value) e.preferredRent = "Preferred rent can't be above your maximum.";
    }
    if (s === 3) {
      const f = p.floor.value;
      if (f.min != null && f.max != null && f.min > f.max) e.floor = "Minimum floor is above maximum floor.";
    }
    return e;
  }

  function go(to: number) {
    if (to > step) {
      for (let s = step; s < to; s++) {
        const e = validateStep(s);
        if (Object.keys(e).length) {
          setErrors(e);
          setStep(s);
          return;
        }
      }
    }
    setErrors({});
    setBanner(null);
    setStep(to);
    window.scrollTo({ top: 0 });
  }

  function save(submit: boolean) {
    const all = { ...validateStep(0), ...validateStep(1), ...validateStep(3) };
    if (submit && Object.keys(all).length) {
      setErrors(all);
      setBanner({ tone: "unmet", text: "Some answers need attention before you submit." });
      return;
    }
    const payload: RequirementProfile = {
      ...p,
      name: p.name.trim(),
      avatarUrl: p.avatarUrl?.trim() ? p.avatarUrl.trim() : null,
      notes: p.notes?.trim() ?? "",
    };
    startTransition(async () => {
      const res = await saveRequirements(groupId, payload, submit);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setBanner({ tone: "unmet", text: res.error ?? "Could not save." });
        return;
      }
      if (submit) {
        router.push(`/groups/${groupId}?submitted=1`);
        router.refresh();
      } else {
        setBanner({ tone: "accent", text: "Draft saved. Only you can see it." });
      }
    });
  }

  /** Rows for the prioritisation step: only requirements the person actually expressed. */
  const priorityRows: { key: string; label: string; value: Priority; onChange: (v: Priority) => void }[] = [
    { key: "commute", label: `Commute to ${p.work.label || "work"} ≤ ${p.commute.value} min`, value: p.commute.priority, onChange: (v) => set("commute", { ...p.commute, priority: v }) },
    ...(p.secondaryDestination && p.secondaryCommute
      ? [{ key: "secondary", label: `Reach ${p.secondaryDestination.label} ≤ ${p.secondaryCommute.value} min`, value: p.secondaryCommute.priority, onChange: (v: Priority) => set("secondaryCommute", { ...p.secondaryCommute!, priority: v }) }]
      : []),
    { key: "budget", label: `My share is at most ${inr(p.maxRent.value)}`, value: p.maxRent.priority, onChange: (v) => set("maxRent", { ...p.maxRent, priority: v }) },
    ...(p.preferredRent
      ? [{ key: "prefRent", label: `My share is around ${inr(p.preferredRent.value)}`, value: p.preferredRent.priority, onChange: (v: Priority) => set("preferredRent", { ...p.preferredRent!, priority: v }) }]
      : []),
    ...(p.utilitiesIncluded.value ? [{ key: "utilities", label: "Utilities included in rent", value: p.utilitiesIncluded.priority, onChange: (v: Priority) => set("utilitiesIncluded", { ...p.utilitiesIncluded, priority: v }) }] : []),
    ...(p.areas.value.preferred.length || p.areas.value.acceptable.length
      ? [{ key: "areas", label: `In my preferred areas (${p.areas.value.preferred.join(", ") || "none"})`, value: p.areas.priority, onChange: (v: Priority) => set("areas", { ...p.areas, priority: v }) }]
      : []),
    ...(p.excludedAreas.value.length
      ? [{ key: "excluded", label: `Not in ${p.excludedAreas.value.join(", ")}`, value: p.excludedAreas.priority, onChange: (v: Priority) => set("excludedAreas", { ...p.excludedAreas, priority: v }) }]
      : []),
    { key: "bedrooms", label: `At least ${p.bedrooms.value} bedrooms`, value: p.bedrooms.priority, onChange: (v) => set("bedrooms", { ...p.bedrooms, priority: v }) },
    { key: "bathrooms", label: `At least ${p.bathrooms.value} bathrooms`, value: p.bathrooms.priority, onChange: (v) => set("bathrooms", { ...p.bathrooms, priority: v }) },
    ...(p.lift.value.required
      ? [{ key: "lift", label: p.lift.value.aboveFloor > 0 ? `Lift if the flat is above floor ${p.lift.value.aboveFloor}` : "Lift", value: p.lift.priority, onChange: (v: Priority) => set("lift", { ...p.lift, priority: v }) }]
      : []),
    ...(p.parking.value !== "none" ? [{ key: "parking", label: p.parking.value === "car" ? "Car parking" : "Two-wheeler parking", value: p.parking.priority, onChange: (v: Priority) => set("parking", { ...p.parking, priority: v }) }] : []),
    ...(p.furnishing.value.length ? [{ key: "furnishing", label: `Furnishing: ${p.furnishing.value.join(" or ")}`, value: p.furnishing.priority, onChange: (v: Priority) => set("furnishing", { ...p.furnishing, priority: v }) }] : []),
    ...(p.petFriendly.value ? [{ key: "pet", label: "Pet friendly", value: p.petFriendly.priority, onChange: (v: Priority) => set("petFriendly", { ...p.petFriendly, priority: v }) }] : []),
    ...(p.balcony.value ? [{ key: "balcony", label: "Balcony", value: p.balcony.priority, onChange: (v: Priority) => set("balcony", { ...p.balcony, priority: v }) }] : []),
    ...(p.floor.value.min != null || p.floor.value.max != null
      ? [{ key: "floor", label: `Floor between ${p.floor.value.min ?? "any"} and ${p.floor.value.max ?? "any"}`, value: p.floor.priority, onChange: (v: Priority) => set("floor", { ...p.floor, priority: v }) }]
      : []),
    ...p.amenities.map((a) => ({
      key: `amenity-${a.amenity}`,
      label: AMENITY_LABELS[a.amenity],
      value: a.priority,
      onChange: (v: Priority) => set("amenities", p.amenities.map((x) => (x.amenity === a.amenity ? { ...x, priority: v } : x))),
    })),
  ];

  const dealbreakers = priorityRows.filter((r) => r.value === "DEALBREAKER");

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Form steps" className="lg:sticky lg:top-6 lg:self-start">
        <ol className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
          {STEPS.map((s, i) => (
            <li key={s} className="shrink-0">
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={i === step ? "step" : undefined}
                className={`flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                  i === step ? "bg-accent-soft font-semibold text-accent" : "text-ink-2 hover:bg-surface-2"
                }`}
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-current text-xs">{i + 1}</span>
                {s}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <Card className="p-5 sm:p-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step < STEPS.length - 1) go(step + 1);
            else save(true);
          }}
          className="space-y-6"
          noValidate
        >
          <h2 className="font-display text-2xl">{STEPS[step]}</h2>

          {step === 0 && (
            <div className="space-y-5">
              <Field label="Your name" htmlFor="name" error={errors.name}>
                <input id="name" className={inputClass} value={p.name} maxLength={40} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="Profile image link (optional)" htmlFor="avatar" hint="An https:// link to a photo. Leave empty to use your initials." error={errors.avatarUrl}>
                <input id="avatar" className={inputClass} value={p.avatarUrl ?? ""} placeholder="https://…" onChange={(e) => set("avatarUrl", e.target.value)} />
              </Field>
              <Field label="Where do you work or study?" htmlFor="work" error={errors.work}>
                <select
                  id="work"
                  className={inputClass}
                  value={p.work.placeId}
                  onChange={(e) => {
                    const place = PUNE_PLACES.find((x) => x.id === e.target.value);
                    if (place) set("work", { placeId: place.id, label: place.label.replace(/ \(.*\)$/, ""), point: place.point });
                  }}
                >
                  <option value="">Choose a location…</option>
                  {PUNE_PLACES.map((pl) => (
                    <option key={pl.id} value={pl.id}>{pl.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Longest one-way commute you'd accept (minutes)" htmlFor="commute" hint="Commute times are estimated from distance, not live traffic." error={errors.commute}>
                <input id="commute" type="number" inputMode="numeric" min={5} max={180} className={inputClass} value={p.commute.value}
                  onChange={(e) => set("commute", { ...p.commute, value: num(e.target.value, p.commute.value) })} />
              </Field>
              <div className="rounded-xl bg-surface-2 p-4">
                <Field label="Another place you go often (optional)" htmlFor="second" hint="A gym, family home, college…">
                  <select
                    id="second"
                    className={inputClass}
                    value={p.secondaryDestination?.placeId ?? ""}
                    onChange={(e) => {
                      const place = PUNE_PLACES.find((x) => x.id === e.target.value);
                      if (!place) {
                        setP((prev) => ({ ...prev, secondaryDestination: null, secondaryCommute: null }));
                        return;
                      }
                      setP((prev) => ({
                        ...prev,
                        secondaryDestination: { placeId: place.id, label: place.label.replace(/ \(.*\)$/, ""), point: place.point },
                        secondaryCommute: prev.secondaryCommute ?? { value: 40, priority: "NICE_TO_HAVE" },
                      }));
                    }}
                  >
                    <option value="">None</option>
                    {PUNE_PLACES.map((pl) => (
                      <option key={pl.id} value={pl.id}>{pl.label}</option>
                    ))}
                  </select>
                </Field>
                {p.secondaryCommute && (
                  <div className="mt-3">
                    <Field label="Max minutes to get there" htmlFor="secondMin">
                      <input id="secondMin" type="number" min={5} max={180} className={inputClass} value={p.secondaryCommute.value}
                        onChange={(e) => set("secondaryCommute", { ...p.secondaryCommute!, value: num(e.target.value, p.secondaryCommute!.value) })} />
                    </Field>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <Field label="Maximum monthly rent you can contribute (₹)" htmlFor="maxRent" hint="Your share, not the whole flat. FlatMatch assumes an equal three-way split." error={errors.maxRent}>
                <input id="maxRent" type="number" inputMode="numeric" step={500} min={1000} className={inputClass} value={p.maxRent.value}
                  onChange={(e) => set("maxRent", { ...p.maxRent, value: num(e.target.value, p.maxRent.value) })} />
              </Field>
              <div className="space-y-3 rounded-xl bg-surface-2 p-4">
                <label className="flex min-h-[44px] items-center gap-3 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={!!p.preferredRent}
                    onChange={(e) => set("preferredRent", e.target.checked ? { value: Math.round(p.maxRent.value * 0.85 / 500) * 500, priority: "NICE_TO_HAVE" } : null)} />
                  I&apos;d prefer to pay less than my maximum
                </label>
                {p.preferredRent && (
                  <Field label="Preferred contribution (₹)" htmlFor="prefRent" error={errors.preferredRent}>
                    <input id="prefRent" type="number" step={500} className={inputClass} value={p.preferredRent.value}
                      onChange={(e) => set("preferredRent", { ...p.preferredRent!, value: num(e.target.value, p.preferredRent!.value) })} />
                  </Field>
                )}
              </div>
              <Choice
                legend="Utilities (electricity, water, maintenance)"
                value={p.utilitiesIncluded.value ? "yes" : "no"}
                onChange={(v) => set("utilitiesIncluded", { ...p.utilitiesIncluded, value: v === "yes" })}
                options={[
                  { value: "no", label: "Paying them separately is fine" },
                  { value: "yes", label: "I want them included in rent" },
                ]}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-ink-2">
                Mark each area. <b>Preferred</b> gets full credit, <b>acceptable</b> partial credit, and <b>exclude</b> means you won&apos;t
                consider it (you&apos;ll set how strict that is in Priorities).
              </p>
              {errors.excludedAreas && <Notice tone="unmet">{errors.excludedAreas}</Notice>}
              <div className="divide-y divide-line rounded-xl border border-line">
                {PUNE_LOCALITIES.map((loc) => (
                  <fieldset key={loc} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <legend className="float-left text-sm font-medium sm:w-40">{loc}</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {(["preferred", "acceptable", "excluded", "none"] as AreaChoice[]).map((c) => {
                        const active = areaChoice(loc) === c;
                        const tone =
                          c === "excluded" ? "border-unmet bg-unmet-soft text-unmet" : c === "none" ? "border-ink-3 bg-surface-2 text-ink" : "border-accent bg-accent-soft text-accent";
                        return (
                          <label key={c} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium ${active ? tone : "border-line text-ink-2 hover:bg-surface-2"}`}>
                            <input type="radio" name={`area-${loc}`} className="sr-only" checked={active} onChange={() => setArea(loc, c)} />
                            {{ preferred: "Preferred", acceptable: "Acceptable", excluded: "Exclude", none: "No opinion" }[c]}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Minimum bedrooms (whole flat)" htmlFor="bed">
                  <select id="bed" className={inputClass} value={p.bedrooms.value} onChange={(e) => set("bedrooms", { ...p.bedrooms, value: num(e.target.value, 3) })}>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Field>
                <Field label="Minimum bathrooms" htmlFor="bath">
                  <select id="bath" className={inputClass} value={p.bathrooms.value} onChange={(e) => set("bathrooms", { ...p.bathrooms, value: num(e.target.value, 2) })}>
                    {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Field>
              </div>

              <Choice
                legend="Lift"
                value={!p.lift.value.required ? "no" : p.lift.value.aboveFloor === 0 ? "always" : "above"}
                onChange={(v) =>
                  set("lift", { ...p.lift, value: v === "no" ? { ...p.lift.value, required: false } : { required: true, aboveFloor: v === "always" ? 0 : p.lift.value.aboveFloor || 2 } })
                }
                options={[
                  { value: "no", label: "Not needed" },
                  { value: "above", label: "Needed above a certain floor" },
                  { value: "always", label: "Always needed" },
                ]}
              />
              {p.lift.value.required && p.lift.value.aboveFloor > 0 && (
                <Field label="I can take the stairs up to floor…" htmlFor="liftFloor">
                  <input id="liftFloor" type="number" min={1} max={40} className={inputClass} value={p.lift.value.aboveFloor}
                    onChange={(e) => set("lift", { ...p.lift, value: { required: true, aboveFloor: Math.max(1, num(e.target.value, 2)) } })} />
                </Field>
              )}

              <Choice
                legend="Parking"
                value={p.parking.value}
                onChange={(v) => set("parking", { ...p.parking, value: v })}
                options={[
                  { value: "none", label: "Not needed" },
                  { value: "two-wheeler", label: "Two-wheeler" },
                  { value: "car", label: "Car" },
                ]}
              />

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Furnishing you&apos;d accept (leave empty if you don&apos;t mind)</legend>
                <div className="flex flex-wrap gap-2">
                  {(["furnished", "semi-furnished", "unfurnished"] as Furnishing[]).map((f) => (
                    <label key={f} className="flex min-h-[44px] items-center gap-2 rounded-lg border border-line px-3 text-sm">
                      <input type="checkbox" className="h-4 w-4" checked={p.furnishing.value.includes(f)} onChange={(e) => toggleFurnishing(f, e.target.checked)} />
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex min-h-[44px] items-center gap-3 rounded-lg border border-line px-3 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={p.petFriendly.value} onChange={(e) => set("petFriendly", { ...p.petFriendly, value: e.target.checked })} />
                  I need a pet-friendly flat
                </label>
                <label className="flex min-h-[44px] items-center gap-3 rounded-lg border border-line px-3 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={p.balcony.value} onChange={(e) => set("balcony", { ...p.balcony, value: e.target.checked })} />
                  I want a balcony
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Lowest floor you'd like (optional)" htmlFor="fmin" error={errors.floor}>
                  <input id="fmin" type="number" min={0} max={60} className={inputClass} value={p.floor.value.min ?? ""}
                    onChange={(e) => set("floor", { ...p.floor, value: { ...p.floor.value, min: e.target.value === "" ? null : num(e.target.value, 0) } })} />
                </Field>
                <Field label="Highest floor you'd like (optional)" htmlFor="fmax">
                  <input id="fmax" type="number" min={0} max={60} className={inputClass} value={p.floor.value.max ?? ""}
                    onChange={(e) => set("floor", { ...p.floor, value: { ...p.floor.value, max: e.target.value === "" ? null : num(e.target.value, 0) } })} />
                </Field>
              </div>

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Other things you need or want</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {AMENITIES.map((a) => (
                    <label key={a} className="flex min-h-[44px] items-center gap-3 rounded-lg border border-line px-3 text-sm">
                      <input type="checkbox" className="h-4 w-4" checked={p.amenities.some((x) => x.amenity === a)} onChange={(e) => toggleAmenity(a, e.target.checked)} />
                      {AMENITY_LABELS[a]}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <Notice>
                <p><b>Dealbreaker</b>: a flat that fails this is removed for the whole group. Use sparingly.</p>
                <p><b>Must have</b>: weighted {100}. Missing it is flagged as a severe compromise. <b>Strong preference</b>: 50. <b>Nice to have</b>: 20.</p>
              </Notice>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {priorityRows.map((r) => (
                  <li key={r.key} className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
                    <span className="text-sm font-medium">{r.label}</span>
                    <PrioritySelect value={r.value} onChange={r.onChange} label={r.label} />
                  </li>
                ))}
              </ul>
              {dealbreakers.length > 4 && (
                <Notice tone="partial">
                  You have {dealbreakers.length} dealbreakers. Each one can remove flats for all three of you. Could some be must-haves instead?
                </Notice>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <ul className="space-y-2 text-sm">
                {priorityRows.map((r) => (
                  <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
                    <span>{r.label}</span>
                    <span className="text-xs font-semibold text-ink-2">{PRIORITY_LABELS[r.value]}</span>
                  </li>
                ))}
              </ul>
              <Field label="Anything else your flatmates should know? (optional)" htmlFor="notes" hint="Not scored. Shown to the group after the comparison.">
                <textarea id="notes" rows={3} maxLength={500} className={inputClass} value={p.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
              </Field>
              <p className="text-sm text-ink-2">
                Your answers stay private until all three people have submitted. {submittedBefore ? "Submitting again replaces your earlier answers." : ""}
              </p>
            </div>
          )}

          {banner && <Notice tone={banner.tone}>{banner.text}</Notice>}

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              {step > 0 && (
                <Button type="button" variant="ghost" onClick={() => go(step - 1)}>
                  Back
                </Button>
              )}
              <Button type="button" variant="secondary" disabled={pending} onClick={() => save(false)}>
                Save draft
              </Button>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : step < STEPS.length - 1 ? "Continue" : submittedBefore ? "Update my requirements" : "Submit my requirements"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
