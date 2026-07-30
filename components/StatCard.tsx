import type { LucideIcon } from "lucide-react";
import clsx from "clsx";

export default function StatCard({
  label,
  value,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { direction: "up" | "down"; value: string };
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-card dark:border-border-dark dark:bg-surface-dark">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</div>
          <div className="mt-1.5 text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {value}
          </div>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
          <Icon size={18} />
        </div>
      </div>
      {trend && (
        <div
          className={clsx(
            "mt-2 text-xs font-medium",
            trend.direction === "up" ? "text-green-600" : "text-red-600"
          )}
        >
          {trend.direction === "up" ? "↑" : "↓"} {trend.value}
        </div>
      )}
    </div>
  );
}
