import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveGuardRedirect } from "@/lib/auth/guard";
import { PortalShell } from "@/components/shell/PortalShell";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin" },
  { label: "Students", href: "/admin/students" },
  { label: "Lecturers", href: "/admin/lecturers" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Fees & Payments", href: "/admin/payments" },
  { label: "Notices", href: "/admin/notices" },
  { label: "Support Tickets", href: "/admin/tickets" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: { role: string; full_name: string } | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
    profile = data;
  }

  const redirectTo = resolveGuardRedirect(profile, "admin");
  if (redirectTo) redirect(redirectTo);

  return (
    <PortalShell navItems={NAV_ITEMS} roleLabel="Admin Portal" userLabel={profile!.full_name}>
      {children}
    </PortalShell>
  );
}
