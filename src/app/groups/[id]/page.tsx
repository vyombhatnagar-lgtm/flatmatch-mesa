import Link from "next/link";
import { createInvitation, reopenGroup, revokeInvitation } from "@/app/actions";
import { CopyLink } from "@/components/group/copy-link";
import { Avatar, Badge, Button, ButtonLink, Card, Notice, PageHeader } from "@/components/ui";
import { SupabaseMissing } from "@/components/supabase-missing";
import { requireGroup } from "@/lib/group-page";
import { loadInvitations } from "@/lib/groups";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Group status" };

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return <SupabaseMissing />;
  const { id } = await params;
  const { supabase, group, members, me, isCoordinator } = await requireGroup(id);
  const invitations = isCoordinator ? await loadInvitations(supabase, id) : [];
  const pending = invitations.filter((i) => i.status === "pending");
  const submitted = members.filter((m) => m.status === "submitted").length;
  const full = members.length === 3;
  const allIn = full && submitted === 3;
  const analyzed = group.status === "analyzed";
  const openSlots = 3 - members.length;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={isCoordinator ? "You are the coordinator" : "Group status"} title={group.name}>
        {analyzed
          ? "Results are ready. Everyone in the group sees the same results."
          : allIn
            ? "All three people have submitted. The coordinator can start the comparison."
            : `${submitted} of 3 people have submitted their requirements. FlatMatch waits for all three before comparing anything.`}
      </PageHeader>

      {analyzed && (
        <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium">Your group&apos;s options are ready.</p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/groups/${id}/results`}>View results</ButtonLink>
            {isCoordinator && (
              <form action={reopenGroup}>
                <input type="hidden" name="groupId" value={id} />
                <Button variant="secondary" type="submit">Reopen for edits</Button>
              </form>
            )}
          </div>
        </Card>
      )}

      <section aria-labelledby="members">
        <h2 id="members" className="mb-3 font-semibold">Members ({members.length}/3)</h2>
        <ul className="grid gap-3 md:grid-cols-3">
          {members.map((m, i) => (
            <li key={m.user_id}>
              <Card className="flex h-full items-center gap-3 p-4">
                <Avatar name={m.display_name} index={i} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.display_name} {m.user_id === me?.user_id && <span className="text-ink-3">(you)</span>}
                  </p>
                  <p className="text-xs text-ink-3">{m.role === "coordinator" ? "Coordinator" : "Participant"}</p>
                </div>
                <Badge tone={m.status === "submitted" ? "met" : m.status === "draft" ? "partial" : "neutral"}>
                  {m.status === "submitted" ? "Submitted" : m.status === "draft" ? "In progress" : "Not started"}
                </Badge>
              </Card>
            </li>
          ))}
          {Array.from({ length: openSlots }).map((_, i) => (
            <li key={`open-${i}`}>
              <Card className="flex h-full items-center gap-3 border-dashed p-4 text-ink-3">Waiting for someone to join</Card>
            </li>
          ))}
        </ul>
      </section>

      {!analyzed && me && (
        <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Your requirements</p>
            <p className="text-sm text-ink-2">
              {me.status === "submitted"
                ? "Submitted. You can still edit them until the comparison runs."
                : "Your answers stay private until all three people have submitted."}
            </p>
          </div>
          <ButtonLink href={`/groups/${id}/requirements`} variant={me.status === "submitted" ? "secondary" : "primary"}>
            {me.status === "submitted" ? "Edit my requirements" : me.status === "draft" ? "Continue my requirements" : "Fill in my requirements"}
          </ButtonLink>
        </Card>
      )}

      {isCoordinator && !analyzed && openSlots > 0 && (
        <section aria-labelledby="invites" className="space-y-3">
          <h2 id="invites" className="font-semibold">Invite your flatmates</h2>
          <p className="text-sm text-ink-2">
            Send each person their own link (WhatsApp works). FlatMatch does not send emails in this MVP. Each link works once.
          </p>
          {pending.slice(0, openSlots).map((inv, i) => (
            <Card key={inv.id} className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Invite link {i + 1}</p>
                <form action={revokeInvitation}>
                  <input type="hidden" name="groupId" value={id} />
                  <input type="hidden" name="invitationId" value={inv.id} />
                  <button type="submit" className="text-xs text-ink-3 underline hover:text-unmet">Revoke</button>
                </form>
              </div>
              <CopyLink path={`/invite/${inv.token}`} label={`Invite link ${i + 1}`} />
            </Card>
          ))}
          {pending.length < openSlots && (
            <form action={createInvitation}>
              <input type="hidden" name="groupId" value={id} />
              <Button variant="secondary" type="submit">Create another invite link</Button>
            </form>
          )}
        </section>
      )}

      {isCoordinator && !analyzed && (
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Compare listings</h2>
          {allIn ? (
            <>
              <p className="text-sm text-ink-2">Everyone has submitted. Once you start, requirements are locked (you can reopen them later).</p>
              <ButtonLink href={`/groups/${id}/analyzing`}>Find flats that work for all three</ButtonLink>
            </>
          ) : (
            <Notice>
              Available once all 3 members have joined and submitted. Waiting for:{" "}
              {[
                ...members.filter((m) => m.status !== "submitted").map((m) => m.display_name),
                ...Array.from({ length: openSlots }).map(() => "an invited flatmate"),
              ].join(", ")}
              .
            </Notice>
          )}
        </Card>
      )}

      {!isCoordinator && !analyzed && (
        <p className="text-sm text-ink-3">The coordinator starts the comparison once all three of you have submitted.</p>
      )}

      <p className="text-sm">
        <Link href="/dashboard" className="text-accent underline underline-offset-2">← All my searches</Link>
      </p>
    </div>
  );
}
