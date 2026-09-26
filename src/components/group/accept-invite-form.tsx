"use client";
import { useActionState } from "react";
import { acceptInvite, type ActionState } from "@/app/actions";
import { Button, Card, Field, Notice, inputClass } from "@/components/ui";

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(acceptInvite, undefined);
  return (
    <Card className="p-6">
      <form action={action} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <Field label="Your name (as your flatmates know you)" htmlFor="displayName">
          <input id="displayName" name="displayName" className={inputClass} required maxLength={40} autoComplete="given-name" />
        </Field>
        {state?.error && <Notice tone="unmet">{state.error}</Notice>}
        <Button type="submit" disabled={pending}>{pending ? "Joining…" : "Join and fill in my requirements"}</Button>
      </form>
    </Card>
  );
}
