import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VideoPlayer from "@/components/video/VideoPlayer";
import type { TrainingModule } from "@/lib/types";

export default async function VideoDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: training } = await supabase
    .from("training_modules")
    .select("*")
    .eq("id", params.id)
    .eq("is_video", true)
    .single<TrainingModule>();

  if (!training) notFound();

  const { data: progress } = await supabase
    .from("training_progress")
    .select("*")
    .eq("training_id", training.id)
    .eq("user_id", user?.id)
    .maybeSingle();

  const { data: signed } = await supabase.storage
    .from("training-files")
    .createSignedUrl(training.file_path, 60 * 60 * 2);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{training.title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{training.description}</p>
      </div>

      {signed?.signedUrl && user ? (
        <VideoPlayer
          url={signed.signedUrl}
          trainingId={training.id}
          userId={user.id}
          resumeSeconds={progress?.last_position_seconds ?? 0}
          durationSeconds={training.video_duration_seconds}
          completed={progress?.status === "completed"}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-gray-400 dark:border-border-dark">
          Video not found in storage.
        </div>
      )}
    </div>
  );
}
