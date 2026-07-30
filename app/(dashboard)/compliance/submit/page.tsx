import { createClient } from "@/lib/supabase/server";
import SubmissionForm from "@/components/compliance/SubmissionForm";

export default async function SubmitCompliancePage() {
  const supabase = createClient();
  const { data: categories } = await supabase.from("compliance_categories").select("id, name").order("name");
  const { data: branches } = await supabase.from("branches").select("id, name").order("name");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">New compliance submission</h1>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        Submit checklist evidence, inspection photos, or reports for review.
      </p>
      <div className="rounded-xl border border-border bg-surface p-6 shadow-card dark:border-border-dark dark:bg-surface-dark">
        <SubmissionForm categories={categories ?? []} branches={branches ?? []} />
      </div>
    </div>
  );
}
