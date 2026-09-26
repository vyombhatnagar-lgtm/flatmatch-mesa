"use client";
import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type ActionState } from "@/app/actions";
import { Button, Card, Field, Notice, inputClass } from "@/components/ui";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(mode === "login" ? signIn : signUp, undefined);
  const other = mode === "login" ? "/signup" : "/login";
  return (
    <Card className="mx-auto max-w-md p-6 sm:p-8">
      <h1 className="mb-1 font-display text-2xl">{mode === "login" ? "Sign in" : "Create your account"}</h1>
      <p className="mb-6 text-sm text-ink-2">
        {mode === "login" ? "Welcome back." : "You need an account so your answers are saved and private to your group."}
      </p>
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next} />
        {mode === "signup" && (
          <Field label="First name" htmlFor="displayName">
            <input id="displayName" name="displayName" className={inputClass} autoComplete="given-name" required maxLength={40} />
          </Field>
        )}
        <Field label="Email" htmlFor="email">
          <input id="email" name="email" type="email" className={inputClass} autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
          <input
            id="password"
            name="password"
            type="password"
            className={inputClass}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={8}
          />
        </Field>
        {state?.error && <Notice tone="unmet">{state.error}</Notice>}
        {state?.message && <Notice tone="accent">{state.message}</Notice>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-2">
        {mode === "login" ? "New to FlatMatch? " : "Already have an account? "}
        <Link className="font-medium text-accent underline underline-offset-2" href={`${other}?next=${encodeURIComponent(next)}`}>
          {mode === "login" ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </Card>
  );
}
