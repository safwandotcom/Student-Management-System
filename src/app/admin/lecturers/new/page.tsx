"use client";

import { useActionState } from "react";
import { createLecturer } from "./actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function NewLecturerPage() {
  const [state, formAction, pending] = useActionState<{ error: string | null }, FormData>(
    createLecturer,
    { error: null }
  );

  return (
    <Card className="max-w-xl">
      <h1 className="mb-1 text-lg font-semibold text-ink-900">Add Lecturer</h1>
      <p className="mb-6 text-sm text-ink-500">
        An invite email will be sent so they can set their own password.
      </p>
      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="full_name" className="mb-1 block text-sm font-medium text-ink-700">
            Full name
          </label>
          <input id="full_name" name="full_name" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink-700">
            Email
          </label>
          <input id="email" name="email" type="email" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="department" className="mb-1 block text-sm font-medium text-ink-700">
            Department
          </label>
          <input id="department" name="department" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="designation" className="mb-1 block text-sm font-medium text-ink-700">
            Designation
          </label>
          <input id="designation" name="designation" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        {state.error && <p className="text-sm text-danger-700">{state.error}</p>}
        <Button type="submit" loading={pending} className="w-full">
          Send Invite
        </Button>
      </form>
    </Card>
  );
}
