"use client";

import { useActionState } from "react";
import { createStudent } from "./actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function NewStudentPage() {
  const [state, formAction, pending] = useActionState<{ error: string | null }, FormData>(
    createStudent,
    { error: null }
  );

  return (
    <Card className="max-w-xl">
      <h1 className="mb-1 text-lg font-semibold text-ink-900">Add Student</h1>
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
          <label htmlFor="student_id" className="mb-1 block text-sm font-medium text-ink-700">
            Student ID (roll)
          </label>
          <input id="student_id" name="student_id" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="program" className="mb-1 block text-sm font-medium text-ink-700">
            Program
          </label>
          <input id="program" name="program" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="batch" className="mb-1 block text-sm font-medium text-ink-700">
            Batch
          </label>
          <input id="batch" name="batch" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="guardian_name" className="mb-1 block text-sm font-medium text-ink-700">
              Guardian name
            </label>
            <input id="guardian_name" name="guardian_name" className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="guardian_phone" className="mb-1 block text-sm font-medium text-ink-700">
              Guardian phone
            </label>
            <input id="guardian_phone" name="guardian_phone" className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
          </div>
        </div>
        {state.error && <p className="text-sm text-danger-700">{state.error}</p>}
        <Button type="submit" loading={pending} className="w-full">
          Send Invite
        </Button>
      </form>
    </Card>
  );
}
