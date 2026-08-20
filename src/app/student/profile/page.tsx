import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";

interface StudentDetail {
  student_id: string;
  program: string;
  batch: string;
  guardian_name: string | null;
  guardian_phone: string | null;
}

export default async function StudentProfilePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user!.id)
    .single();

  const { data } = await supabase
    .from("students")
    .select("student_id, program, batch, guardian_name, guardian_phone")
    .eq("profile_id", user!.id)
    .single();
  const student = data as StudentDetail | null;

  const fields: { label: string; value: string }[] = [
    { label: "Full name", value: profile?.full_name ?? "—" },
    { label: "Email", value: user?.email ?? "—" },
    { label: "Phone", value: profile?.phone ?? "—" },
    { label: "Student ID", value: student?.student_id ?? "—" },
    { label: "Program", value: student?.program ?? "—" },
    { label: "Batch", value: student?.batch ?? "—" },
    { label: "Guardian name", value: student?.guardian_name ?? "—" },
    { label: "Guardian phone", value: student?.guardian_phone ?? "—" },
  ];

  return (
    <Card className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ink-900">My Profile</h1>
        <p className="text-sm text-ink-500">Your account details.</p>
      </div>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{field.label}</dt>
            <dd className="mt-1 text-sm text-ink-900">{field.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
