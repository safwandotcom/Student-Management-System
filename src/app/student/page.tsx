import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";

export default async function StudentDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .single();

  const { data: studentRow } = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", user!.id)
    .single();

  const { count: enrollmentCount } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentRow?.id ?? "");

  const quickLinks = [
    { label: "Courses", href: "/student/courses", description: `${enrollmentCount ?? 0} enrolled this term` },
    { label: "Attendance", href: "/student/attendance", description: "Coming soon" },
    { label: "Results", href: "/student/results", description: "Coming soon" },
    { label: "Fees & Payments", href: "/student/payments", description: "Coming soon" },
    { label: "Profile", href: "/student/profile", description: "View your details" },
    { label: "Support Tickets", href: "/student/tickets", description: "Coming soon" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <h1 className="text-lg font-semibold text-ink-900">Welcome, {profile?.full_name ?? "Student"}</h1>
        <p className="text-sm text-ink-500">
          You are enrolled in {enrollmentCount ?? 0} course{enrollmentCount === 1 ? "" : "s"} this term.
        </p>
      </Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full transition hover:border-brand-300">
              <h2 className="text-sm font-semibold text-ink-900">{link.label}</h2>
              <p className="mt-1 text-sm text-ink-500">{link.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
