import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DeactivateButton } from "./DeactivateButton";
import { EditLecturerForm } from "./EditLecturerForm";

interface LecturerDetail {
  id: string;
  department: string;
  designation: string;
  profile_id: string;
  profiles: { full_name: string; status: string } | null;
}

export default async function LecturerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("lecturers")
    .select("id, department, designation, profile_id, profiles(full_name, status)")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const lecturer = data as unknown as LecturerDetail;
  const profile = lecturer.profiles ?? { full_name: "Unknown", status: "unknown" };

  return (
    <Card className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">{profile.full_name}</h1>
          <p className="text-sm text-ink-500">{lecturer.designation}</p>
        </div>
        <Badge tone={profile.status === "active" ? "success" : "neutral"}>{profile.status}</Badge>
      </div>
      <EditLecturerForm lecturer={lecturer} />
      <DeactivateButton
        profileId={lecturer.profile_id}
        currentStatus={profile.status}
        revalidateTo={`/admin/lecturers/${lecturer.id}`}
      />
    </Card>
  );
}
