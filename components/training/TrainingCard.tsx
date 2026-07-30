import Link from "next/link";
import clsx from "clsx";
import { FileText, PlayCircle, Clock } from "lucide-react";
import type { TrainingModule, TrainingStatus } from "@/lib/types";

const STATUS_STYLES: Record<TrainingStatus, string> = {
  not_started: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  in_progress: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  completed: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
};

const STATUS_LABEL: Record<TrainingStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

export default function TrainingCard({
  training,
  status = "not_started",
}: {
  training: TrainingModule;
  status?: TrainingStatus;
}) {
  const href = training.is_video ? `/video-training/${training.id}` : `/training/${training.id}`;
  const Icon = training.is_video ? PlayCircle : FileText;

  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-border bg-surface p-4 shadow-card transition hover:border-brand-300 dark:border-border-dark dark:bg-surface-dark"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
          <Icon size={18} />
        </div>
        <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[status])}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      <h3 className="mb-1 text-sm font-semibold text-gray-900 group-hover:text-brand-700 dark:text-gray-100 dark:group-hover:text-brand-300">
        {training.title}
      </h3>
      <p className="mb-3 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
        {training.description ?? "No description provided."}
      </p>

      <div className="mt-auto flex items-center justify-between text-[11px] text-gray-400">
        <span>{training.category ?? "General"} · v{training.version}</span>
        {training.estimated_duration_minutes && (
          <span className="flex items-center gap-1">
            <Clock size={11} /> {training.estimated_duration_minutes} min
          </span>
        )}
      </div>
    </Link>
  );
}
