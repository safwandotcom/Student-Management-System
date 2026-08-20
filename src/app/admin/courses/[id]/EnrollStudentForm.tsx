"use client";

import { useActionState } from "react";
import { enrollStudent } from "./actions";
import { Button } from "@/components/ui/Button";

interface StudentOption {
  id: string;
  full_name: string;
  student_id: string;
}

export function EnrollStudentForm({
  courseId,
  offeringId,
  students,
}: {
  courseId: string;
  offeringId: string;
  students: StudentOption[];
}) {
  const [state, formAction, pending] = useActionState(enrollStudent, { error: null });

  return (
    <form action={formAction} className="flex items-end gap-2">
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="offering_id" value={offeringId} />
      <div className="flex-1">
        <select
          name="student_id" required aria-label="Select a student to enroll"
          className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
        >
          <option value="">Select a student…</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.student_id} — {student.full_name}
            </option>
          ))}
        </select>
        {state.error && <p className="mt-1 text-sm text-danger-700">{state.error}</p>}
      </div>
      <Button type="submit" variant="secondary" size="sm" loading={pending}>
        Enroll
      </Button>
    </form>
  );
}
