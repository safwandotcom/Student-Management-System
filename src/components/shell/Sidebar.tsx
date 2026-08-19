"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { NavItem, isActiveLink } from "@/lib/nav";

export function Sidebar({ items, roleLabel }: { items: NavItem[]; roleLabel: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-60 flex-col border-r border-ink-200 bg-ink-900 text-ink-100">
      <div className="border-b border-ink-800 px-5 py-4">
        <p className="text-sm font-semibold text-white">Campus</p>
        <p className="text-xs text-ink-400">{roleLabel}</p>
      </div>
      <ul className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active = isActiveLink(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={clsx(
                  "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-brand-700 text-white" : "text-ink-300 hover:bg-ink-800 hover:text-white"
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
