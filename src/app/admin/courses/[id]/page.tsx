import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EditCourseForm } from "./EditCourseForm";

interface CourseDetail {
  id: string;
  code: string;
  title: string;
  credits: number;
  semester: string;
  department: string;
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

  return (
    <Card className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ink-900">{course.title}</h1>
        <p className="text-sm text-ink-500">{course.code}</p>
      </div>
      <EditCourseForm course={course} />
    </Card>
  );
}
