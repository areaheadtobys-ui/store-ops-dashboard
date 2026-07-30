import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/types";
import clsx from "clsx";

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  pending: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  submitted: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  rejected: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  overdue: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

export default async function CompliancePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  const canSubmit = me
    ? hasPermission(me.role, "compliance.submit") || hasPermission(me.role, "compliance.review")
    : false;

  const { data: submissions } = await supabase
    .from("compliance_submissions")
    .select("id, status, due_date, submitted_at, compliance_categories(name), branches(name)")
    .order("due_date", { ascending: true })
    .limit(50);

  const { data: categories } = await supabase.from("compliance_categories").select("id, name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Store Operations Compliance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Opening/closing checklists, safety inspections, audits, and other branch submissions.
          </p>
        </div>
        {canSubmit && (
          <Link
            href="/compliance/submit"
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus size={15} /> New submission
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {categories?.map((c) => (
          <span
            key={c.id}
            className="rounded-full border border-border px-3 py-1 text-xs text-gray-600 dark:border-border-dark dark:text-gray-300"
          >
            {c.name}
          </span>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card dark:border-border-dark dark:bg-surface-dark">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-subtle text-left text-xs uppercase text-gray-500 dark:border-border-dark dark:bg-subtle-dark dark:text-gray-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium">Branch</th>
              <th className="px-4 py-2.5 font-medium">Due date</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border dark:divide-border-dark">
            {submissions && submissions.length > 0 ? (
              submissions.map((s: any) => (
                <tr key={s.id} className="hover:bg-subtle dark:hover:bg-subtle-dark">
                  <td className="px-4 py-2.5">
                    <Link href={`/compliance/${s.id}`} className="block">
                      {s.compliance_categories?.name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{s.branches?.name ?? "—"}</td>
                  <td className="px-4 py-2.5">{s.due_date ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", STATUS_STYLES[s.status])}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                  No submissions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        Click a row to view attachments and, if you're a Store Manager, Area Head, or Super Admin, approve
        or reject it.
      </p>
    </div>
  );
}
