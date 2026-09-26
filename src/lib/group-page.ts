import "server-only";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { loadGroup } from "@/lib/groups";
import { getUser } from "@/lib/supabase/server";

/** Loads a group for the signed-in user, or 404s if they aren't a member (RLS hides it). */
export async function requireGroup(groupId: string) {
  if (!z.string().uuid().safeParse(groupId).success) notFound();
  const { supabase, user } = await getUser();
  if (!user) redirect(`/login?next=/groups/${groupId}`);
  const loaded = await loadGroup(supabase, groupId);
  if (!loaded) notFound();
  const me = loaded.members.find((m) => m.user_id === user.id);
  const isCoordinator = loaded.group.coordinator_id === user.id;
  return { supabase, user, ...loaded, me, isCoordinator };
}
