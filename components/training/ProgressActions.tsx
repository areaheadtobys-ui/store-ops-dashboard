"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { TrainingStatus } from "@/lib/types";

export default function ProgressActions({
  trainingId,
  userId,
  initialStatus,
  hasQuiz,
}: {
  trainingId: string;
  userId: string;
  initialStatus: TrainingStatus;
  hasQuiz: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [status, setStatus] = useState<TrainingStatus>(initialStatus);
  const [isPending, startTransition] = useTransition();

  function updateStatus(next: TrainingStatus) {
    startTransition(async () => {
      const now = new Date().toISOString();
      await supabase.from("training_progress").upsert(
        {
          training_id: trainingId,
          user_id: userId,
          status: next,
          progress_percent: next === "completed" ? 100 : 50,
          started_at: status === "not_started" ? now : undefined,
          completed_at: next === "completed" ? now : null,
          updated_at: now,
        },
        { onConflict: "training_id,user_id" }
      );
      setStatus(next);
      router.refresh();
    });
  }

  if (status === "completed") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
        <CheckCircle2 size={16} /> Completed
        {hasQuiz && <span className="text-xs font-normal opacity-80">— take the quiz to get certified</span>}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {status === "not_started" && (
        <button
          onClick={() => updateStatus("in_progress")}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <PlayCircle size={15} /> Start training
        </button>
      )}
      <button
        onClick={() => updateStatus("completed")}
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-subtle disabled:opacity-60 dark:border-border-dark dark:hover:bg-subtle-dark"
      >
        <CheckCircle2 size={15} /> Mark complete
      </button>
    </div>
  );
}
