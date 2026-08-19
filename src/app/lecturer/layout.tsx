import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveGuardRedirect } from "@/lib/auth/guard";
import { PortalShell } from "@/components/shell/PortalShell";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/lecturer" },
  { label: "My Courses", href: "/lecturer/courses" },
  { label: "Attendance", href: "/lecturer/attendance" },
  { label: "Gradebook", href: "/lecturer/grades" },
  { label: "Notices", href: "/lecturer/notices" },
  { label: "Support Tickets", href: "/lecturer/tickets" },
];

export default async function LecturerLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: { role: string; full_name: string } | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
    profile = data;
  }

  const redirectTo = resolveGuardRedirect(profile, "lecturer");
  if (redirectTo) redirect(redirectTo);

  return (
    <PortalShell navItems={NAV_ITEMS} roleLabel="Lecturer Portal" userLabel={profile!.full_name}>
      {children}
    </PortalShell>
  );
}
