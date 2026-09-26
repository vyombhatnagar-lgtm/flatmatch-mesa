"use client";
import { useActionState } from "react";
import { createGroup, type ActionState } from "@/app/actions";
import { Button, Card, Field, Notice, inputClass } from "@/components/ui";

export function CreateGroupForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createGroup, undefined);
  return (
    <Card className="p-6">
      <form action={action} className="space-y-4">
        <Field label="Name this search" htmlFor="name" hint="Only your group sees this.">
          <input id="name" name="name" className={inputClass} placeholder="e.g. Pune 3BHK, Nov move-in" required maxLength={80} />
        </Field>
        <Field label="Your name (as your flatmates know you)" htmlFor="displayName">
          <input id="displayName" name="displayName" className={inputClass} defaultValue={defaultName} required maxLength={40} />
        </Field>
        {state?.error && <Notice tone="unmet">{state.error}</Notice>}
        <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create search and get invite links"}</Button>
      </form>
    </Card>
  );
}
