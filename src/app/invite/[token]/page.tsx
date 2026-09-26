import { AcceptInviteForm } from "@/components/group/accept-invite-form";
import { SupabaseMissing } from "@/components/supabase-missing";
import { ButtonLink, Card, Notice, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const metadata = { title: "Join a flat search" };

type Invite = {
  group_id: string;
  group_name: string;
  coordinator_name: string | null;
  status: "pending" | "accepted" | "revoked";
  expired: boolean;
  member_count: number;
  already_member: boolean;
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  if (!isSupabaseConfigured()) return <SupabaseMissing />;
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return <Notice tone="unmet" title="This invitation link is not valid">Ask the coordinator for a new link.</Notice>;
  }
  const { supabase, user } = await getUser();
  const { data } = await supabase.rpc("get_invitation", { p_token: token });
  const inv = (data as Invite[] | null)?.[0];

  if (!inv) return <Notice tone="unmet" title="Invitation not found">Ask the coordinator for a new link.</Notice>;

  if (inv.already_member) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Notice tone="accent">You&apos;re already in “{inv.group_name}”.</Notice>
        <ButtonLink href={`/groups/${inv.group_id}`}>Go to the group</ButtonLink>
      </div>
    );
  }

  const unusable =
    inv.status !== "pending" ? "This invitation has already been used or was revoked." : inv.expired ? "This invitation has expired." : inv.member_count >= 3 ? "This group already has 3 members." : null;

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader eyebrow="You're invited" title={`Join “${inv.group_name}”`}>
        {inv.coordinator_name ?? "A friend"} is looking for a shared flat and wants your requirements. You&apos;ll answer on your own; the
        others won&apos;t see your answers until all three of you have submitted.
      </PageHeader>
      {unusable ? (
        <Notice tone="unmet">{unusable} Ask {inv.coordinator_name ?? "the coordinator"} for a new link.</Notice>
      ) : user ? (
        <AcceptInviteForm token={token} />
      ) : (
        <Card className="space-y-3 p-6">
          <p className="text-sm text-ink-2">Create an account (or sign in) to join. You&apos;ll come straight back here.</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`}>Create account</ButtonLink>
            <ButtonLink href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} variant="secondary">Sign in</ButtonLink>
          </div>
        </Card>
      )}
    </div>
  );
}
