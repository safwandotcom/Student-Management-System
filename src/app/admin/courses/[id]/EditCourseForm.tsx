"use client";

import { useActionState } from "react";
import { updateCourse } from "./actions";
import { Button } from "@/components/ui/Button";

interface EditableCourse {
  id: string;
  title: string;
  credits: number;
  semester: string;
  department: string;
}

export function EditCourseForm({ course }: { course: EditableCourse }) {
  const [state, formAction, pending] = useActionState(updateCourse, { error: null });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={course.id} />
      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-ink-700">
          Title
        </label>
        <input
          id="title" name="title" required defaultValue={course.title}
          className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="credits" className="mb-1 block text-sm font-medium text-ink-700">
            Credits
          </label>
          <input
            id="credits" name="credits" type="number" min="1" step="1" required defaultValue={course.credits}
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="semester" className="mb-1 block text-sm font-medium text-ink-700">
            Semester
          </label>
          <input
            id="semester" name="semester" required defaultValue={course.semester}
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label htmlFor="department" className="mb-1 block text-sm font-medium text-ink-700">
          Department
        </label>
        <input
          id="department" name="department" required defaultValue={course.department}
          className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
        />
      </div>
      {state.error && <p className="text-sm text-danger-700">{state.error}</p>}
      <Button type="submit" variant="secondary" loading={pending}>
        Save changes
      </Button>
    </form>
  );
}
