import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EditCourseForm } from "./EditCourseForm";
import { AddOfferingForm } from "./AddOfferingForm";
import { EnrollStudentForm } from "./EnrollStudentForm";

interface CourseDetail {
  id: string;
  code: string;
  title: string;
  credits: number;
  semester: string;
  department: string;
}

interface OfferingRow {
  id: string;
  term: string;
  lecturers: { profiles: { full_name: string } | null } | null;
  enrollments: { id: string; students: { student_id: string; profiles: { full_name: string } | null } | null }[];
}

interface LecturerOption {
  id: string;
  profiles: { full_name: string; status: string } | null;
}

interface StudentOption {
  id: string;
  student_id: string;
  profiles: { full_name: string; status: string } | null;
}

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("courses")
    .select("id, code, title, credits, semester, department")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const course = data as CourseDetail;

  const { data: offeringsData } = await supabase
    .from("course_offerings")
    .select("id, term, lecturers(profiles(full_name)), enrollments(id, students(student_id, profiles(full_name)))")
    .eq("course_id", id)
    .order("term", { ascending: false });
  const offerings = (offeringsData ?? []) as unknown as OfferingRow[];

  const { data: lecturersData } = await supabase
    .from("lecturers")
    .select("id, profiles!inner(full_name, status)")
    .eq("profiles.status", "active")
    .order("profiles(full_name)", { ascending: true });
  const lecturerOptions = ((lecturersData ?? []) as unknown as LecturerOption[]).map((lecturer) => ({
    id: lecturer.id,
    full_name: lecturer.profiles?.full_name ?? "Unknown",
  }));

  const { data: studentsData } = await supabase
    .from("students")
    .select("id, student_id, profiles!inner(full_name, status)")
    .eq("profiles.status", "active")
    .order("profiles(full_name)", { ascending: true });
  const studentOptions = ((studentsData ?? []) as unknown as StudentOption[]).map((student) => ({
    id: student.id,
    student_id: student.student_id,
    full_name: student.profiles?.full_name ?? "Unknown",
  }));

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">{course.title}</h1>
          <p className="text-sm text-ink-500">{course.code}</p>
        </div>
        <EditCourseForm course={course} />
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-ink-900">Offerings</h2>
        {offerings.length === 0 ? (
          <p className="text-sm text-ink-500">No offerings yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100 text-sm">
            {offerings.map((offering) => (
              <li key={offering.id} className="space-y-2 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-ink-900">{offering.lecturers?.profiles?.full_name ?? "Unknown lecturer"}</span>
                  <span className="text-ink-500">{offering.term}</span>
                </div>
                {offering.enrollments.length > 0 && (
                  <ul className="ml-4 space-y-1 text-xs text-ink-500">
                    {offering.enrollments.map((enrollment) => (
                      <li key={enrollment.id}>
                        {enrollment.students?.student_id} — {enrollment.students?.profiles?.full_name ?? "Unknown student"}
                      </li>
                    ))}
                  </ul>
                )}
                <EnrollStudentForm courseId={course.id} offeringId={offering.id} students={studentOptions} />
              </li>
            ))}
          </ul>
        )}
        <AddOfferingForm courseId={course.id} lecturers={lecturerOptions} />
      </Card>
    </div>
  );
}
