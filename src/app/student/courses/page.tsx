import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";

interface EnrollmentRow {
  id: string;
  course_offerings: {
    term: string;
    courses: { code: string; title: string; credits: number } | null;
    lecturers: { profiles: { full_name: string } | null } | null;
  } | null;
}

export default async function StudentCoursesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: studentRow } = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", user!.id)
    .single();

  const { data } = await supabase
    .from("enrollments")
    .select("id, course_offerings(term, courses(code, title, credits), lecturers(profiles(full_name)))")
    .eq("student_id", studentRow?.id ?? "")
    .order("id", { ascending: true });
  const enrollments = (data ?? []) as unknown as EnrollmentRow[];

  return (
    <Card className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ink-900">My Courses</h1>
        <p className="text-sm text-ink-500">Courses you are enrolled in.</p>
      </div>
      {enrollments.length === 0 ? (
        <p className="text-sm text-ink-500">You are not enrolled in any courses yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-50 text-ink-600">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Credits</th>
                <th className="px-4 py-3 font-medium">Term</th>
                <th className="px-4 py-3 font-medium">Lecturer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {enrollments.map((enrollment) => (
                <tr key={enrollment.id}>
                  <td className="px-4 py-3">{enrollment.course_offerings?.courses?.code ?? "—"}</td>
                  <td className="px-4 py-3">{enrollment.course_offerings?.courses?.title ?? "—"}</td>
                  <td className="px-4 py-3">{enrollment.course_offerings?.courses?.credits ?? "—"}</td>
                  <td className="px-4 py-3">{enrollment.course_offerings?.term ?? "—"}</td>
                  <td className="px-4 py-3">
                    {enrollment.course_offerings?.lecturers?.profiles?.full_name ?? "Unknown lecturer"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
