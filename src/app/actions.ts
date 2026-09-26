"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { RequirementProfileSchema, toProfile, toRequirementItems } from "@/lib/validation/requirements";

export type ActionState = { error?: string; message?: string; ok?: boolean } | undefined;

const NOT_CONFIGURED = "Supabase is not connected, so accounts and saving are unavailable. Try the demo instead.";

/** Only allow relative in-app redirects (prevents open redirects). */
function safeNext(next: FormDataEntryValue | null, fallback = "/dashboard"): string {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.includes("\\") ? s : fallback;
}

function friendly(err: { message?: string } | null | undefined, fallback: string): string {
  const m = err?.message ?? "";
  // Surface our own RPC messages; hide anything that looks like internals.
  if (/^[A-Z][^\n]{3,120}$/.test(m) && !/relation|column|syntax|constraint|violates/i.test(m)) return m;
  return fallback;
}

const credentials = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});

export async function signIn(_: ActionState, form: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Email or password is incorrect." };
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: ActionState, form: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const parsed = credentials
    .extend({ displayName: z.string().trim().min(1, "Tell us your first name.").max(40) })
    .safeParse({ email: form.get("email"), password: form.get("password"), displayName: form.get("displayName") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.displayName } },
  });
  if (error) return { error: friendly(error, "Could not create the account. Try a different email.") };
  if (!data.session) {
    return { ok: true, message: "Account created. Check your email to confirm it, then sign in." };
  }
  redirect(safeNext(form.get("next")));
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}

export async function createGroup(_: ActionState, form: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Give the search a name.").max(80),
      displayName: z.string().trim().min(1, "Enter your name.").max(40),
    })
    .safeParse({ name: form.get("name"), displayName: form.get("displayName") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_search_group", {
    p_name: parsed.data.name,
    p_display_name: parsed.data.displayName,
  });
  if (error || !data) return { error: friendly(error, "Could not create the search. Please try again.") };
  redirect(`/groups/${data}`);
}

export async function acceptInvite(_: ActionState, form: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const parsed = z
    .object({
      token: z.string().regex(/^[a-f0-9]{64}$/, "This invitation link is not valid."),
      displayName: z.string().trim().min(1, "Enter your name.").max(40),
    })
    .safeParse({ token: form.get("token"), displayName: form.get("displayName") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", {
    p_token: parsed.data.token,
    p_display_name: parsed.data.displayName,
  });
  if (error || !data) return { error: friendly(error, "Could not join this search.") };
  redirect(`/groups/${data}/requirements`);
}

const uuid = z.string().uuid();

export async function saveRequirements(
  groupId: string,
  profileInput: unknown,
  submit: boolean,
): Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> }> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED };
  if (!uuid.safeParse(groupId).success) return { ok: false, error: "Invalid group." };
  const parsed = RequirementProfileSchema.safeParse(profileInput);
  let profileJson: unknown;
  let items: ReturnType<typeof toRequirementItems> = [];
  if (parsed.success) {
    const profile = toProfile(parsed.data);
    profileJson = profile;
    items = toRequirementItems(profile);
  } else if (!submit) {
    // Drafts may be incomplete. Store them (size-capped); analysis re-validates everything.
    const draft = z.object({ name: z.string().max(40) }).passthrough().safeParse(profileInput);
    if (!draft.success || JSON.stringify(profileInput).length > 20_000) return { ok: false, error: "Could not save this draft." };
    profileJson = draft.data;
  } else {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { ok: false, error: "Some answers need attention.", fieldErrors };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_requirements", {
    p_group: groupId,
    p_profile: profileJson,
    p_items: items,
    p_submit: submit,
  });
  if (error) return { ok: false, error: friendly(error, "Could not save your requirements.") };
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

export async function reopenGroup(form: FormData) {
  const groupId = String(form.get("groupId") ?? "");
  if (!uuid.safeParse(groupId).success || !isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase.rpc("reopen_group", { p_group: groupId });
  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}`);
}

export async function createInvitation(form: FormData) {
  const groupId = String(form.get("groupId") ?? "");
  if (!uuid.safeParse(groupId).success || !isSupabaseConfigured()) return;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from("invitations").insert({ group_id: groupId, invited_by: auth.user.id, label: "New invite" });
  revalidatePath(`/groups/${groupId}`);
}

export async function revokeInvitation(form: FormData) {
  const groupId = String(form.get("groupId") ?? "");
  const id = String(form.get("invitationId") ?? "");
  if (!uuid.safeParse(groupId).success || !uuid.safeParse(id).success || !isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase.from("invitations").update({ status: "revoked" }).eq("id", id).eq("status", "pending");
  revalidatePath(`/groups/${groupId}`);
}
