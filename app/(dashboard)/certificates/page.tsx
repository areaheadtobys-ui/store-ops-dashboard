import { createClient } from "@/lib/supabase/server";
import { Award } from "lucide-react";

export default async function CertificatesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: certificates } = await supabase
    .from("certificates")
    .select("id, certificate_number, issued_at, training_modules(title)")
    .eq("user_id", user?.id)
    .order("issued_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">My Certificates</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Certificates issued after passing a training quiz with an 80%+ score.
        </p>
      </div>

      {certificates && certificates.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((c: any) => (
            <div key={c.id} className="rounded-xl border border-border bg-surface p-4 shadow-card dark:border-border-dark dark:bg-surface-dark">
              <Award size={20} className="mb-2 text-brand-600" />
              <div className="text-sm font-medium">{c.training_modules?.title}</div>
              <div className="text-xs text-gray-400">
                #{c.certificate_number} · {new Date(c.issued_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-gray-400 dark:border-border-dark">
          No certificates yet — pass a training quiz to earn one.
        </div>
      )}
    </div>
  );
}
