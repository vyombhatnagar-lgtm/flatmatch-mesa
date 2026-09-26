import { personColor } from "@/components/ui";
import { inr } from "@/lib/format";
import type { ResultOption } from "./types";
import { OPTION_LETTERS } from "./types";

/**
 * Side-by-side comparison. Deliberately neutral: no highlighting of the
 * highest value, no "best" labels, same styling for every column.
 */
export function CompareTable({ options }: { options: ResultOption[] }) {
  if (options.length === 0) return null;
  const people = options[0].evaluation.participants.map((p) => p.name);
  type Row = { label: string; cells: React.ReactNode[]; color?: string };

  const majorCompromise = (o: ResultOption) => {
    const ev = o.evaluation;
    const top = ev.severeCompromises[0] ?? ev.compromises.find((c) => c.item.priority === "STRONG_PREFERENCE") ?? ev.compromises[0];
    return top ? `${top.name}: ${top.item.label} (${top.item.detail})` : "None";
  };

  const rows: Row[] = [
    { label: "Rent", cells: options.map((o) => `${inr(o.evaluation.property.rent)} (${inr(o.evaluation.participants[0]?.rentShare ?? 0)} each)`) },
    { label: "Location", cells: options.map((o) => o.evaluation.property.location) },
    { label: "Bedrooms", cells: options.map((o) => o.evaluation.property.bedrooms) },
    { label: "Bathrooms", cells: options.map((o) => o.evaluation.property.bathrooms) },
    {
      label: "Lift",
      cells: options.map((o) => `${o.evaluation.property.lift ? "Yes" : "No"} (floor ${o.evaluation.property.floor}/${o.evaluation.property.totalFloors})`),
    },
    {
      label: "Parking",
      cells: options.map((o) => ({ car: "Car", "two-wheeler": "Two-wheeler only", none: "None" })[o.evaluation.property.parking]),
    },
    { label: "Furnishing", cells: options.map((o) => o.evaluation.property.furnishing) },
    { label: "Pets", cells: options.map((o) => (o.evaluation.property.petFriendly ? "Allowed" : "Not allowed")) },
    ...people.map((name, i) => ({
      label: `${name} fit`,
      color: personColor(i),
      cells: options.map((o) => {
        const pr = o.evaluation.participants.find((p) => p.name === name);
        return pr ? `${pr.fitScore}%` : "–";
      }),
    })),
    ...people.map((name) => ({
      label: `${name} commute`,
      cells: options.map((o) => {
        const pr = o.evaluation.participants.find((p) => p.name === name);
        return pr?.commuteMinutes != null ? `~${pr.commuteMinutes} min (est.)` : "–";
      }),
    })),
    { label: "Group compatibility", cells: options.map((o) => `${o.evaluation.groupScore}%`) },
    { label: "Must-haves missed", cells: options.map((o) => o.evaluation.severeCompromises.length) },
    { label: "Major compromise", cells: options.map(majorCompromise) },
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
        <caption className="sr-only">Side-by-side comparison of shortlisted flats</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="w-44 p-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-3">
              &nbsp;
            </th>
            {options.map((o, i) => (
              <th key={o.evaluation.property.id} scope="col" className="p-3 text-left align-bottom">
                <span className="block text-xs font-semibold uppercase tracking-wide text-ink-3">Option {OPTION_LETTERS[i]}</span>
                <span className="font-semibold">{o.evaluation.property.title}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-line last:border-0">
              <th scope="row" className="p-3 text-left font-medium text-ink-2" style={r.color ? { color: r.color } : undefined}>
                {r.label}
              </th>
              {r.cells.map((c, i) => (
                <td key={i} className="p-3 align-top tabular-nums">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
