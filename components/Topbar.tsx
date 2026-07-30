"use client";

import { useRouter } from "next/navigation";
import { Search, Bell, LogOut } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export default function Topbar({ profile }: { profile: Profile }) {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4 dark:border-border-dark dark:bg-surface-dark">
      <div className="relative w-full max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          placeholder="Search training, SOPs, policies, users…"
          className="w-full rounded-md border border-border bg-subtle py-1.5 pl-8 pr-3 text-sm outline-none focus:border-brand-500 dark:border-border-dark dark:bg-subtle-dark"
        />
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <button
          aria-label="Notifications"
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-subtle dark:text-gray-400 dark:hover:bg-subtle-dark"
        >
          <Bell size={16} />
        </button>

        <div className="mx-1 h-6 w-px bg-border dark:bg-border-dark" />

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
            {profile.full_name.slice(0, 1).toUpperCase()}
          </div>
          <div className="hidden text-xs leading-tight sm:block">
            <div className="font-medium text-gray-800 dark:text-gray-200">{profile.full_name}</div>
            <div className="capitalize text-gray-500 dark:text-gray-400">
              {profile.role.replace("_", " ")}
            </div>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          aria-label="Sign out"
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-subtle dark:text-gray-400 dark:hover:bg-subtle-dark"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
