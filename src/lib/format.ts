export function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export function titleCase(s: string): string {
  return s.replace(/(^|[\s-])(\w)/g, (_, sep: string, c: string) => sep + c.toUpperCase());
}

export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}
