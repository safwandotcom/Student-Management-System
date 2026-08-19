"use client";

import { useActionState } from "react";
import { updateStudent } from "./actions";
import { Button } from "@/components/ui/Button";

interface EditableStudent {
  id: string;
  program: string;
  batch: string;
  guardian_name: string | null;
  guardian_phone: string | null;
}

export function EditStudentForm({ student }: { student: EditableStudent }) {
  const [state, formAction, pending] = useActionState(updateStudent, { error: null });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={student.id} />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="program" className="mb-1 block text-sm font-medium text-ink-700">
            Program
          </label>
          <input
            id="program" name="program" required defaultValue={student.program}
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="batch" className="mb-1 block text-sm font-medium text-ink-700">
            Batch
          </label>
          <input
            id="batch" name="batch" required defaultValue={student.batch}
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="guardian_name" className="mb-1 block text-sm font-medium text-ink-700">
            Guardian name
          </label>
          <input
            id="guardian_name" name="guardian_name" defaultValue={student.guardian_name ?? ""}
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="guardian_phone" className="mb-1 block text-sm font-medium text-ink-700">
            Guardian phone
          </label>
          <input
            id="guardian_phone" name="guardian_phone" defaultValue={student.guardian_phone ?? ""}
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {state.error && <p className="text-sm text-danger-700">{state.error}</p>}
      <Button type="submit" variant="secondary" loading={pending}>
        Save changes
      </Button>
    </form>
  );
}
