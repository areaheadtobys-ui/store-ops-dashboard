import { createClient } from "@/lib/supabase/server";
import { FileDown } from "lucide-react";

const REPORT_TYPES = [
  "Training Completion", "Compliance", "Employee Progress",
  "Store Performance", "Area Performance", "Branch Compliance",
];

export default async function ReportsPage() {
  const supabase = createClient();
  const { count: totalCompleted } = await supabase
    .from("training_progress")
    .select("*", { count: "exact", head: true })
    .eq("status", "completed");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Reports</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Export operational data to Excel, PDF, or CSV.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_TYPES.map((type) => (
          <div key={type} className="rounded-xl border border-border bg-surface p-4 shadow-card dark:border-border-dark dark:bg-surface-dark">
            <div className="mb-3 text-sm font-medium">{type}</div>
            <div className="flex gap-2">
              {["Excel", "PDF", "CSV"].map((fmt) => (
                <button
                  key={fmt}
                  disabled
                  title="Export wiring is the next step — see README"
                  className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-gray-400 dark:border-border-dark"
                >
                  <FileDown size={12} /> {fmt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400">
        {totalCompleted ?? 0} training completions recorded so far. Export buttons are wired up in the UI
        but not yet connected to a generator — the docx/pptx/xlsx skills in this environment show the
        pattern to follow for PDF/Excel export once you're building server-side.
      </p>
    </div>
  );
}
