"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard, GraduationCap, PlayCircle, ClipboardCheck, BookOpen,
  FileText, HelpCircle, Award, BarChart3, Users, Bell, Settings, Building2,
} from "lucide-react";
import type { UserRole } from "@/lib/types";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/training", label: "Training Center", icon: GraduationCap },
  { href: "/video-training", label: "Video Training", icon: PlayCircle },
  { href: "/compliance", label: "Store Compliance", icon: ClipboardCheck },
  { href: "/sop-library", label: "SOP Library", icon: BookOpen },
  { href: "/policies", label: "Policies", icon: FileText },
  { href: "/examination", label: "Examination", icon: HelpCircle },
  { href: "/certificates", label: "Certificates", icon: Award },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/users", label: "Users", icon: Users, adminOnly: true },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const isAdmin = role === "super_admin" || role === "area_head";

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface md:flex md:flex-col dark:border-border-dark dark:bg-surface-dark">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4 dark:border-border-dark">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white">
          <Building2 size={16} />
        </div>
        <span className="text-sm font-semibold">Store Ops</span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition",
                active
                  ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                  : "text-gray-600 hover:bg-subtle dark:text-gray-400 dark:hover:bg-subtle-dark"
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
