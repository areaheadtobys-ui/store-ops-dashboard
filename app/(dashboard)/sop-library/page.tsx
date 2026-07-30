import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function SopLibraryPage() {
  const supabase = createClient();
  const { data: docs } = await supabase
    .from("documents")
    .select("*")
    .in("doc_type", ["sop", "manual", "guideline", "form"])
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">SOP Library</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Standard operating procedures, manuals, guidelines, and forms.
        </p>
      </div>

      {docs && docs.length > 0 ? (
        <div className="divide-y divide-border rounded-xl border border-border bg-surface shadow-card dark:divide-border-dark dark:border-border-dark dark:bg-surface-dark">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3">
              <FileText size={16} className="text-brand-600" />
              <div className="flex-1">
                <div className="text-sm font-medium">{d.title}</div>
                <div className="text-xs capitalize text-gray-400">{d.doc_type} · v{d.version}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-gray-400 dark:border-border-dark">
          No documents uploaded yet.
        </div>
      )}
    </div>
  );
}
