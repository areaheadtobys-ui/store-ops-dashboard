import { Users, GraduationCap, ClipboardCheck, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import StatCard from "@/components/StatCard";
import TrainingProgressChart from "@/components/charts/TrainingProgressChart";
import ComplianceStatusChart from "@/components/charts/ComplianceStatusChart";

export default async function DashboardPage() {
  const supabase = createClient();

  const [
    { count: totalEmployees },
    { count: activeUsers },
    { count: completedTraining },
    { count: totalProgress },
    { count: pendingCompliance },
    { data: recentTraining },
    { data: announcements },
    { count: approved },
    { count: pending },
    { count: rejected },
    { count: overdue },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("training_progress").select("*", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("training_progress").select("*", { count: "exact", head: true }),
    supabase.from("compliance_submissions").select("*", { count: "exact", head: true }).in("status", ["pending", "submitted"]),
    supabase.from("training_modules").select("id,title,category,created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("announcements").select("id,title,created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("compliance_submissions").select("*", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("compliance_submissions").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("compliance_submissions").select("*", { count: "exact", head: true }).eq("status", "rejected"),
    supabase.from("compliance_submissions").select("*", { count: "exact", head: true }).eq("status", "overdue"),
  ]);

  const completionRate = totalProgress ? Math.round(((completedTraining ?? 0) / totalProgress) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Company-wide snapshot of training, compliance, and activity.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Employees" value={totalEmployees ?? 0} icon={Users} />
        <StatCard label="Active Users" value={activeUsers ?? 0} icon={Users} />
        <StatCard label="Training Completion Rate" value={`${completionRate}%`} icon={GraduationCap} />
        <StatCard label="Pending Compliance" value={pendingCompliance ?? 0} icon={ClipboardCheck} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card lg:col-span-2 dark:border-border-dark dark:bg-surface-dark">
          <h2 className="mb-3 text-sm font-semibold">Training progress (last 6 months)</h2>
          <TrainingProgressChart
            labels={["Feb", "Mar", "Apr", "May", "Jun", "Jul"]}
            data={[62, 68, 71, 75, 80, completionRate]}
          />
          <p className="mt-2 text-xs text-gray-400">
            Historical months are illustrative until reporting rollups are wired to real snapshots — see Reports.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-card dark:border-border-dark dark:bg-surface-dark">
          <h2 className="mb-3 text-sm font-semibold">Store compliance status</h2>
          <ComplianceStatusChart
            approved={approved ?? 0}
            pending={pending ?? 0}
            rejected={rejected ?? 0}
            overdue={overdue ?? 0}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card dark:border-border-dark dark:bg-surface-dark">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <GraduationCap size={15} /> Recently uploaded training
          </h2>
          {recentTraining && recentTraining.length > 0 ? (
            <ul className="divide-y divide-border dark:divide-border-dark">
              {recentTraining.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium">{t.title}</span>
                  <span className="text-xs text-gray-400">{t.category ?? "Uncategorized"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="No training uploaded yet." />
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-card dark:border-border-dark dark:bg-surface-dark">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck size={15} /> Recent announcements
          </h2>
          {announcements && announcements.length > 0 ? (
            <ul className="divide-y divide-border dark:divide-border-dark">
              {announcements.map((a) => (
                <li key={a.id} className="py-2 text-sm font-medium">{a.title}</li>
              ))}
            </ul>
          ) : (
            <EmptyState text="No announcements posted yet." />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-gray-400">{text}</p>;
}
