import { ButtonLink, Notice } from "@/components/ui";

export function SupabaseMissing() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Notice tone="partial" title="Supabase is not connected">
        This deployment has no NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY, so accounts, groups and saving
        are switched off. Nothing you enter would be stored.
      </Notice>
      <ButtonLink href="/demo" variant="secondary">
        Open the demo instead
      </ButtonLink>
    </div>
  );
}
