import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DeactivateButton } from "./DeactivateButton";
import { EditStudentForm } from "./EditStudentForm";

interface StudentDetail {
  id: string;
  student_id: string;
  program: string;
  batch: string;
  guardian_name: string | null;
  guardian_phone: string | null;
  profile_id: string;
  profiles: { full_name: string; status: string } | null;
}

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("students")
    .select("id, student_id, program, batch, guardian_name, guardian_phone, profile_id, profiles(full_name, status)")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const student = data as unknown as StudentDetail;
  const profile = student.profiles ?? { full_name: "Unknown", status: "unknown" };

  return (
    <Card className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">{profile.full_name}</h1>
          <p className="text-sm text-ink-500">{student.student_id}</p>
        </div>
        <Badge tone={profile.status === "active" ? "success" : "neutral"}>{profile.status}</Badge>
      </div>
      <EditStudentForm student={student} />
      <DeactivateButton
        profileId={student.profile_id}
        currentStatus={profile.status}
        revalidateTo={`/admin/students/${student.id}`}
      />
    </Card>
  );
}
