import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveGuardRedirect } from "@/lib/auth/guard";
import { PortalShell } from "@/components/shell/PortalShell";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/student" },
  { label: "My Courses", href: "/student/courses" },
  { label: "Attendance", href: "/student/attendance" },
  { label: "Results", href: "/student/results" },
  { label: "Fees & Payments", href: "/student/payments" },
  { label: "Profile", href: "/student/profile" },
  { label: "Support Tickets", href: "/student/tickets" },
];

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: { role: string; full_name: string } | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
    profile = data;
  }

  const redirectTo = resolveGuardRedirect(profile, "student");
  if (redirectTo) redirect(redirectTo);

  return (
    <PortalShell navItems={NAV_ITEMS} roleLabel="Student Portal" userLabel={profile!.full_name}>
      {children}
    </PortalShell>
  );
}
