import Link from "next/link";
import { defaultProfile } from "@/components/form/defaults";
import { RequirementsForm } from "@/components/form/requirements-form";
import { SupabaseMissing } from "@/components/supabase-missing";
import { Notice, PageHeader } from "@/components/ui";
import { requireGroup } from "@/lib/group-page";
import type { RequirementProfile } from "@/lib/matching/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "My requirements" };

export default async function RequirementsPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return <SupabaseMissing />;
  const { id } = await params;
  const { supabase, user, group, me } = await requireGroup(id);

  if (group.status === "analyzed") {
    return (
      <Notice tone="partial" title="Requirements are locked">
        The comparison has already run. Ask the coordinator to reopen the group if you need to change anything.{" "}
        <Link href={`/groups/${id}/results`} className="underline">View results</Link>
      </Notice>
    );
  }

  const { data: row } = await supabase
    .from("participant_requirements")
    .select("profile, status")
    .eq("group_id", id)
    .eq("user_id", user.id)
    .maybeSingle<{ profile: Partial<RequirementProfile>; status: "draft" | "submitted" }>();

  const initial: RequirementProfile = { ...defaultProfile(me?.display_name ?? ""), ...(row?.profile ?? {}) };

  return (
    <div>
      <PageHeader eyebrow={group.name} title="What do you need from the flat?">
        Answer for yourself only. The others can&apos;t see your answers until all three of you have submitted, so nobody
        anchors on anyone else. About 4 minutes.
      </PageHeader>
      <RequirementsForm groupId={id} initial={initial} submittedBefore={row?.status === "submitted"} />
    </div>
  );
}
