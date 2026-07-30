"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ComplianceStatus } from "@/lib/types";

export default function ReviewActions({
  submissionId,
  reviewerId,
  currentStatus,
}: {
  submissionId: string;
  reviewerId: string;
  currentStatus: ComplianceStatus;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [comments, setComments] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showRejectBox, setShowRejectBox] = useState(false);

  function review(status: "approved" | "rejected") {
    startTransition(async () => {
      await supabase
        .from("compliance_submissions")
        .update({
          status,
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          review_comments: comments || null,
        })
        .eq("id", submissionId);
      router.refresh();
    });
  }

  if (currentStatus === "approved" || currentStatus === "rejected") {
    return null; // already decided — the status badge on the page speaks for itself
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-card dark:border-border-dark dark:bg-surface-dark">
      <h2 className="text-sm font-semibold">Review this submission</h2>

      {showRejectBox && (
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Reason for rejection (visible to the submitter)"
          className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-border-dark"
          rows={3}
        />
      )}

      <div className="flex gap-2">
        <button
          onClick={() => review("approved")}
          disabled={isPending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
        >
          <CheckCircle2 size={15} /> Approve
        </button>
        <button
          onClick={() => (showRejectBox ? review("rejected") : setShowRejectBox(true))}
          disabled={isPending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:hover:bg-red-950"
        >
          <XCircle size={15} /> {showRejectBox ? "Confirm reject" : "Reject"}
        </button>
      </div>
    </div>
  );
}
