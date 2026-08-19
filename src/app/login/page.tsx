"use client";

import { useActionState } from "react";
import { signIn } from "./actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<{ error: string | null }, FormData>(
    signIn,
    { error: null }
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-lg font-semibold text-ink-900">Sign in</h1>
        <p className="mb-6 text-sm text-ink-500">Use the account your administrator gave you.</p>
        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink-700">Email</label>
            <input
              id="email" name="email" type="email" required
              className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink-700">Password</label>
            <input
              id="password" name="password" type="password" required
              className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
            />
          </div>
          {state.error && <p className="text-sm text-danger-700">{state.error}</p>}
          <Button type="submit" loading={pending} className="w-full">Sign in</Button>
        </form>
      </Card>
    </div>
  );
}
