"use client";

import { useActionState } from "react";
import { updateLecturer } from "./actions";
import { Button } from "@/components/ui/Button";

interface EditableLecturer {
  id: string;
  department: string;
  designation: string;
}

export function EditLecturerForm({ lecturer }: { lecturer: EditableLecturer }) {
  const [state, formAction, pending] = useActionState(updateLecturer, { error: null });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={lecturer.id} />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="department" className="mb-1 block text-sm font-medium text-ink-700">
            Department
          </label>
          <input
            id="department" name="department" required defaultValue={lecturer.department}
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="designation" className="mb-1 block text-sm font-medium text-ink-700">
            Designation
          </label>
          <input
            id="designation" name="designation" required defaultValue={lecturer.designation}
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
