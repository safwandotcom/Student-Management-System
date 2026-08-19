"use client";

import { useActionState } from "react";
import { createCourse } from "./actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function NewCoursePage() {
  const [state, formAction, pending] = useActionState<{ error: string | null }, FormData>(
    createCourse,
    { error: null }
  );

  return (
    <Card className="max-w-xl">
      <h1 className="mb-1 text-lg font-semibold text-ink-900">Add Course</h1>
      <p className="mb-6 text-sm text-ink-500">Create a new course in the catalog.</p>
      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="code" className="mb-1 block text-sm font-medium text-ink-700">
            Course code
          </label>
          <input id="code" name="code" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium text-ink-700">
            Title
          </label>
          <input id="title" name="title" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="credits" className="mb-1 block text-sm font-medium text-ink-700">
              Credits
            </label>
            <input
              id="credits" name="credits" type="number" min="1" step="1" required
              className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="semester" className="mb-1 block text-sm font-medium text-ink-700">
              Semester
            </label>
            <input id="semester" name="semester" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label htmlFor="department" className="mb-1 block text-sm font-medium text-ink-700">
            Department
          </label>
          <input id="department" name="department" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        {state.error && <p className="text-sm text-danger-700">{state.error}</p>}
        <Button type="submit" loading={pending} className="w-full">
          Create Course
        </Button>
      </form>
    </Card>
  );
}
