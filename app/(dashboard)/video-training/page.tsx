import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import TrainingCard from "@/components/training/TrainingCard";
import { hasPermission } from "@/lib/types";
import type { TrainingModule, TrainingStatus } from "@/lib/types";

export default async function VideoTrainingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  const { data: videos } = await supabase
    .from("training_modules")
    .select("*")
    .eq("is_video", true)
    .order("created_at", { ascending: false })
    .returns<TrainingModule[]>();

  const { data: progressRows } = await supabase
    .from("training_progress")
    .select("training_id, status")
    .eq("user_id", user?.id);

  const progressByTraining = new Map<string, TrainingStatus>(
    (progressRows ?? []).map((p) => [p.training_id, p.status as TrainingStatus])
  );

  const canUpload = profile ? hasPermission(profile.role, "training.upload") : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Video Training</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Watch, resume, and track completion of video modules.
          </p>
        </div>
        {canUpload && (
          <Link
            href="/training/upload"
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus size={15} /> Upload video
          </Link>
        )}
      </div>

      {videos && videos.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <TrainingCard key={v.id} training={v} status={progressByTraining.get(v.id)} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-12 text-center dark:border-border-dark">
          <p className="text-sm text-gray-500 dark:text-gray-400">No video training uploaded yet.</p>
        </div>
      )}
    </div>
  );
}
