import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function PoliciesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: docs } = await supabase
    .from("documents")
    .select("*")
    .in("doc_type", ["policy", "memo"])
    .order("created_at", { ascending: false });

  const { data: acks } = await supabase
    .from("document_acknowledgments")
    .select("document_id")
    .eq("user_id", user?.id);

  const ackedIds = new Set((acks ?? []).map((a) => a.document_id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Policies &amp; Memos</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Company policies requiring electronic acknowledgment.
        </p>
      </div>

      {docs && docs.length > 0 ? (
        <div className="divide-y divide-border rounded-xl border border-border bg-surface shadow-card dark:divide-border-dark dark:border-border-dark dark:bg-surface-dark">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3">
              <ShieldCheck size={16} className="text-brand-600" />
              <div className="flex-1">
                <div className="text-sm font-medium">{d.title}</div>
                <div className="text-xs capitalize text-gray-400">{d.doc_type} · v{d.version}</div>
              </div>
              {d.requires_acknowledgment && (
                <span
                  className={
                    ackedIds.has(d.id)
                      ? "rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-950 dark:text-green-300"
                      : "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  }
                >
                  {ackedIds.has(d.id) ? "Acknowledged" : "Needs acknowledgment"}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-gray-400 dark:border-border-dark">
          No policies or memos posted yet.
        </div>
      )}
    </div>
  );
}
