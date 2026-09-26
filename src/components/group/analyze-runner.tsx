"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ButtonLink, Card, Notice } from "@/components/ui";

const STAGES = [
  "Loading all three people's requirements",
  "Retrieving listings (mock Pune data)",
  "Removing flats that break a dealbreaker",
  "Checking must-haves for each person",
  "Scoring preferences and group compatibility",
  "Writing explanations",
];

export function AnalyzeRunner({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const timer = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 900);
    (async () => {
      try {
        const res = await fetch(`/api/groups/${groupId}/analyze`, { method: "POST" });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
        clearInterval(timer);
        setStage(STAGES.length);
        router.replace(`/groups/${groupId}/results`);
        router.refresh();
      } catch (e) {
        clearInterval(timer);
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    })();
    return () => clearInterval(timer);
  }, [groupId, router]);

  return (
    <div className="mx-auto max-w-lg">
      <Card className="p-6 sm:p-8">
        <h1 className="mb-1 font-display text-2xl">Comparing listings against all three of you</h1>
        <p className="mb-6 text-sm text-ink-2">The scoring is fixed rules, so the same inputs always give the same result.</p>
        <ol className="space-y-3" aria-live="polite">
          {STAGES.map((s, i) => (
            <li key={s} className="flex items-center gap-3 text-sm">
              <span
                aria-hidden
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  i < stage ? "bg-met-soft text-met" : i === stage && !error ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-3"
                }`}
              >
                {i < stage ? "✓" : i + 1}
              </span>
              <span className={i <= stage ? "text-ink" : "text-ink-3"}>{s}</span>
            </li>
          ))}
        </ol>
        {error && (
          <div className="mt-6 space-y-3">
            <Notice tone="unmet" title="The comparison didn't finish">{error}</Notice>
            <ButtonLink href={`/groups/${groupId}`} variant="secondary">Back to the group</ButtonLink>
          </div>
        )}
      </Card>
    </div>
  );
}
