import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { NavItem } from "@/lib/nav";
import { Button } from "@/components/ui/Button";
import { signOut } from "@/lib/auth/actions";

export function PortalShell({
  navItems,
  roleLabel,
  userLabel,
  children,
}: {
  navItems: NavItem[];
  roleLabel: string;
  userLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-ink-50">
      <Sidebar items={navItems} roleLabel={roleLabel} />
      <div className="flex-1 min-w-0">
        <header className="flex items-center justify-end border-b border-ink-200 bg-white px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-600">{userLabel}</span>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
