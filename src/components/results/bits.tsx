import { Badge, Notice } from "@/components/ui";
import { inr } from "@/lib/format";
import { PRIORITY_LABELS } from "@/lib/matching/config";
import { AMENITY_LABELS } from "@/lib/matching/engine";
import type { Property, RequirementResult } from "@/lib/matching/types";
import type { RunMeta } from "@/lib/groups";
import type { ExplanationResult } from "@/lib/explain/types";

export function StatusIcon({ status }: { status: RequirementResult["status"] }) {
  const map = {
    met: { sym: "✓", cls: "bg-met-soft text-met", label: "Met" },
    partial: { sym: "~", cls: "bg-partial-soft text-partial", label: "Partly met" },
    unmet: { sym: "✕", cls: "bg-unmet-soft text-unmet", label: "Not met" },
  }[status];
  return (
    <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${map.cls}`}>
      <span aria-hidden>{map.sym}</span>
      <span className="sr-only">{map.label}</span>
    </span>
  );
}

export function PriorityTag({ priority }: { priority: RequirementResult["priority"] }) {
  const tone = priority === "DEALBREAKER" ? "unmet" : priority === "MUST_HAVE" ? "partial" : "neutral";
  return (
    <Badge tone={tone} className="whitespace-nowrap">
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}

export function PropertyFacts({ p, compact = false }: { p: Property; compact?: boolean }) {
  const facts = [
    `${p.bedrooms} bed`,
    `${p.bathrooms} bath`,
    `Floor ${p.floor}/${p.totalFloors}`,
    p.lift ? "Lift" : "No lift",
    p.parking === "car" ? "Car parking" : p.parking === "two-wheeler" ? "2-wheeler parking" : "No parking",
    p.furnishing.charAt(0).toUpperCase() + p.furnishing.slice(1),
    p.petFriendly ? "Pets OK" : "No pets",
  ];
  if (!compact) {
    if (p.balcony) facts.push("Balcony");
    facts.push(...p.amenities.map((a) => AMENITY_LABELS[a]));
  }
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Key facts">
      {facts.map((f) => (
        <li key={f} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-2">
          {f}
        </li>
      ))}
    </ul>
  );
}

export function RentLine({ p, people }: { p: Property; people: number }) {
  return (
    <p className="text-sm">
      <span className="text-lg font-semibold">{inr(p.rent)}</span>
      <span className="text-ink-3">/month</span>
      <span className="ml-2 text-ink-2">· {inr(Math.round(p.rent / people))} each (equal split)</span>
      {p.utilitiesIncluded && <span className="ml-2 text-ink-3">· utilities incl.</span>}
    </p>
  );
}

export function ListingImage({ p, className = "" }: { p: Property; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-surface-2 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.imageUrl} alt={`Illustration for ${p.title}`} className="h-full w-full object-cover" loading="lazy" />
      {p.source === "mock" && (
        <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
          Mock listing
        </span>
      )}
    </div>
  );
}

export function DataSourceBar({ meta }: { meta: RunMeta }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs" aria-label="Data sources">
      <Badge tone={meta.providerIsMock ? "partial" : "met"}>
        Listings: {meta.providerName}
        {meta.providerIsMock ? " (illustrative, not real offers)" : ""}
      </Badge>
      <Badge tone={meta.locationIsLive ? "met" : "partial"}>
        Commute: {meta.locationIsLive ? "live directions" : "estimated from distance (mock)"}
      </Badge>
      <Badge tone={meta.geminiConfigured ? "accent" : "neutral"}>
        Explanations: {meta.geminiConfigured ? "Gemini (AI) with rule-based fallback" : "rule-based (Gemini not connected)"}
      </Badge>
    </div>
  );
}

export function ExplanationSource({ ex }: { ex: ExplanationResult | null }) {
  if (!ex) return null;
  if (ex.source === "gemini") {
    return <p className="text-[11px] text-ink-3">Explanation written by Gemini ({ex.model}) from the rule-based results. It does not affect scores.</p>;
  }
  return <p className="text-[11px] text-ink-3">Rule-based explanation. {ex.fallbackReason}</p>;
}

export function DecisionFooter() {
  return (
    <Notice tone="accent" className="mt-10 text-center">
      <p className="font-display text-lg">FlatMatch does not choose your flat.</p>
      <p>It makes the trade-offs visible so your group can decide.</p>
    </Notice>
  );
}
