import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:opacity-90 border border-transparent",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-2 border border-transparent",
  danger: "bg-surface text-unmet border border-line hover:bg-unmet-soft",
};
const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={clsx(base, variants[variant], className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={clsx(base, variants[variant], className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("rounded-2xl border border-line bg-surface", className)} {...props} />;
}

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: "neutral" | "met" | "partial" | "unmet" | "accent" }) {
  const tones = {
    neutral: "bg-surface-2 text-ink-2",
    met: "bg-met-soft text-met",
    partial: "bg-partial-soft text-partial",
    unmet: "bg-unmet-soft text-unmet",
    accent: "bg-accent-soft text-accent",
  };
  return (
    <span
      className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}
      {...props}
    />
  );
}

export function Notice({
  tone = "neutral",
  title,
  children,
  className,
}: {
  tone?: "neutral" | "partial" | "unmet" | "accent";
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "border-line bg-surface-2 text-ink-2",
    partial: "border-partial/30 bg-partial-soft text-ink",
    unmet: "border-unmet/30 bg-unmet-soft text-ink",
    accent: "border-accent/30 bg-accent-soft text-ink",
  };
  return (
    <div role="note" className={clsx("rounded-xl border px-4 py-3 text-sm", tones[tone], className)}>
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      <div>{children}</div>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-3">{hint}</p>}
      {error && (
        <p className="text-xs font-medium text-unmet" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-3 min-h-[44px]";

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-8">
      {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>}
      <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">{title}</h1>
      {children && <div className="mt-3 max-w-2xl text-ink-2">{children}</div>}
    </div>
  );
}

const PERSON_COLORS = ["var(--p1)", "var(--p2)", "var(--p3)"];
export function personColor(index: number): string {
  return PERSON_COLORS[index % PERSON_COLORS.length];
}

export function Avatar({ name, index, url, size = 36 }: { name: string; index: number; url?: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ width: size, height: size, background: personColor(index) }}
    >
      {initials}
    </span>
  );
}

/** Neutral horizontal meter. Never colour-coded as good/bad to avoid implying a winner. */
export function Meter({ value, label, color }: { value: number; label: string; color?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
      >
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: color ?? "var(--ink-2)" }} />
      </div>
      <span className="w-10 text-right text-sm font-semibold tabular-nums">{v}%</span>
    </div>
  );
}
