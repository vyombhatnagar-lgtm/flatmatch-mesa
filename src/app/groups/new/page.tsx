import { redirect } from "next/navigation";
import { CreateGroupForm } from "@/components/group/create-group-form";
import { SupabaseMissing } from "@/components/supabase-missing";
import { PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const metadata = { title: "Start a search" };

export default async function NewGroup() {
  if (!isSupabaseConfigured()) return <SupabaseMissing />;
  const { supabase, user } = await getUser();
  if (!user) redirect("/signup?next=/groups/new");
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader eyebrow="Step 1 of 3" title="Start a flat search">
        You&apos;ll be the coordinator. Next you&apos;ll get two invite links for your flatmates. Each person fills in their own
        requirements, and nobody sees anyone else&apos;s answers until all three are in.
      </PageHeader>
      <CreateGroupForm defaultName={profile?.display_name ?? ""} />
    </div>
  );
}
