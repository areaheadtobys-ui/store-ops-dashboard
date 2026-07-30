import { createClient } from "@/lib/supabase/server";
import { Bell } from "lucide-react";
import clsx from "clsx";

export default async function NotificationsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user?.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Notifications</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Training assignments, deadlines, and updates relevant to you.
        </p>
      </div>

      {notifications && notifications.length > 0 ? (
        <div className="divide-y divide-border rounded-xl border border-border bg-surface shadow-card dark:divide-border-dark dark:border-border-dark dark:bg-surface-dark">
          {notifications.map((n) => (
            <div key={n.id} className={clsx("flex gap-3 px-4 py-3", !n.read && "bg-brand-50/40 dark:bg-brand-900/10")}>
              <Bell size={16} className="mt-0.5 text-brand-600" />
              <div>
                <div className="text-sm font-medium">{n.title}</div>
                {n.body && <div className="text-xs text-gray-500 dark:text-gray-400">{n.body}</div>}
                <div className="mt-0.5 text-[11px] text-gray-400">
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-gray-400 dark:border-border-dark">
          You're all caught up.
        </div>
      )}
    </div>
  );
}
