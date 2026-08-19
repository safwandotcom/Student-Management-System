import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { NavItem } from "@/lib/nav";

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
      <div className="flex-1">
        <header className="flex items-center justify-end border-b border-ink-200 bg-white px-6 py-3">
          <span className="text-sm text-ink-600">{userLabel}</span>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
