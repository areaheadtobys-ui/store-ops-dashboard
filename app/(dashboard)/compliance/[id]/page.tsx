import { notFound } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, FileText, Image as ImageIcon, FileSpreadsheet, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/types";
import ReviewActions from "@/components/compliance/ReviewActions";
import type { ComplianceStatus, FileKind } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  pending: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  submitted: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  rejected: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  overdue: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

const KIND_ICON: Record<FileKind, any> = {
  pdf: FileText,
  xlsx: FileSpreadsheet,
  image: ImageIcon,
  video: PlayCircle,
  pptx: FileText,
  docx: FileText,
  other: FileText,
};

export default async function ComplianceDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  const { data: submission } = await supabase
    .from("compliance_submissions")
    .select(
      "*, compliance_categories(name), branches(name), submitter:submitted_by(full_name), reviewer:reviewed_by(full_name)"
    )
    .eq("id", params.id)
    .single<any>();

  if (!submission) notFound();

  const { data: attachments } = await supabase
    .from("compliance_attachments")
    .select("*")
    .eq("submission_id", submission.id);

  const attachmentsWithUrls = await Promise.all(
    (attachments ?? []).map(async (a) => {
      const { data: signed } = await supabase.storage.from("compliance-files").createSignedUrl(a.file_path, 3600);
      return { ...a, url: signed?.signedUrl };
    })
  );

  const canReview = me ? hasPermission(me.role, "compliance.review") : false;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/compliance" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
        <ArrowLeft size={14} /> Back to compliance
      </Link>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-card dark:border-border-dark dark:bg-surface-dark">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {submission.compliance_categories?.name}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{submission.branches?.name}</p>
          </div>
          <span className={clsx("rounded-full px-2.5 py-1 text-xs font-medium capitalize", STATUS_STYLES[submission.status])}>
            {submission.status}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Row label="Submitted by" value={submission.submitter?.full_name ?? "—"} />
          <Row label="Due date" value={submission.due_date ?? "—"} />
          <Row label="Submitted at" value={submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : "—"} />
          <Row label="Reviewed by" value={submission.reviewer?.full_name ?? "—"} />
        </dl>

        {submission.review_comments && (
          <div className="mt-4 rounded-md bg-subtle p-3 text-sm dark:bg-subtle-dark">
            <span className="font-medium">Review comments: </span>
            {submission.review_comments}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-card dark:border-border-dark dark:bg-surface-dark">
        <h2 className="mb-3 text-sm font-semibold">Attachments</h2>
        {attachmentsWithUrls.length > 0 ? (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {attachmentsWithUrls.map((a) => {
              const Icon = KIND_ICON[a.file_kind as FileKind] ?? FileText;
              return (
                <li key={a.id}>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:border-brand-300 dark:border-border-dark"
                  >
                    <Icon size={15} className="text-brand-600" />
                    <span className="truncate">{a.file_path.split("/").pop()}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">No attachments.</p>
        )}
      </div>

      {canReview && user && (
        <ReviewActions
          submissionId={submission.id}
          reviewerId={user.id}
          currentStatus={submission.status as ComplianceStatus}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="font-medium text-gray-800 dark:text-gray-200">{value}</div>
    </div>
  );
}
