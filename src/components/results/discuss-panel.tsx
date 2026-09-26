"use client";
import { useId, useState } from "react";
import { Button } from "@/components/ui";

export interface Agreement {
  person: string;
  text: string;
  severe: boolean;
}

/**
 * "Discuss this option": turns each compromise into an explicit agreement the
 * group would need to make. Ticks are local to this browser and not saved.
 */
export function DiscussPanel({ agreements, questions }: { agreements: Agreement[]; questions: string[] }) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const id = useId();
  const done = Object.values(checked).filter(Boolean).length;

  return (
    <div className="rounded-xl border border-line">
      <Button
        variant="ghost"
        className="w-full justify-between rounded-xl"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <span>Discuss this option</span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </Button>
      {open && (
        <div id={id} className="space-y-4 border-t border-line p-4">
          <div>
            <p className="font-semibold">What would we need to agree to for this flat to work?</p>
            <p className="text-xs text-ink-3">Tick what the group has agreed to. Ticks stay in this browser only and are not saved.</p>
          </div>
          {agreements.length === 0 ? (
            <p className="text-sm text-ink-2">Nobody has to compromise on anything they rated. Check what the numbers can&apos;t capture: the owner, the building, the rooms.</p>
          ) : (
            <ul className="space-y-2">
              {agreements.map((a, i) => (
                <li key={i}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-surface-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={!!checked[i]}
                      onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))}
                    />
                    <span className="text-sm">
                      <span className="font-medium">{a.person}</span> {a.text}
                      {a.severe && <span className="ml-1 text-xs font-medium text-partial">(must-have)</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {agreements.length > 0 && (
            <p className="text-sm text-ink-2" aria-live="polite">
              {done} of {agreements.length} agreed.
            </p>
          )}
          {questions.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-semibold">Questions to talk through</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
                {questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
