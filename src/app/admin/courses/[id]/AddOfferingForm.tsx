"use client";

import { useActionState } from "react";
import { createOffering } from "./actions";
import { Button } from "@/components/ui/Button";

interface LecturerOption {
  id: string;
  full_name: string;
}

export function AddOfferingForm({ courseId, lecturers }: { courseId: string; lecturers: LecturerOption[] }) {
  const [state, formAction, pending] = useActionState(createOffering, { error: null });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="course_id" value={courseId} />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="lecturer_id" className="mb-1 block text-sm font-medium text-ink-700">
            Lecturer
          </label>
          <select
            id="lecturer_id" name="lecturer_id" required
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          >
            <option value="">Select a lecturer…</option>
            {lecturers.map((lecturer) => (
              <option key={lecturer.id} value={lecturer.id}>
                {lecturer.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="term" className="mb-1 block text-sm font-medium text-ink-700">
            Term
          </label>
          <input
            id="term" name="term" required placeholder="e.g. Fall 2026"
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {state.error && <p className="text-sm text-danger-700">{state.error}</p>}
      <Button type="submit" variant="secondary" loading={pending}>
        Add Offering
      </Button>
    </form>
  );
}
