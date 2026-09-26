"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

export function CopyLink({ path, label }: { path: string; label: string }) {
  const [url, setUrl] = useState(path);
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(window.location.origin + path), [path]);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        readOnly
        value={url}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        className="min-h-[44px] w-full flex-1 truncate rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-xs"
      />
      <Button
        type="button"
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
      >
        <span aria-live="polite">{copied ? "Copied" : "Copy link"}</span>
      </Button>
    </div>
  );
}
