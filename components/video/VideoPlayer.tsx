"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SAVE_INTERVAL_MS = 5000;

export default function VideoPlayer({
  url,
  trainingId,
  userId,
  resumeSeconds,
  durationSeconds,
  completed,
}: {
  url: string;
  trainingId: string;
  userId: string;
  resumeSeconds: number;
  durationSeconds: number | null;
  completed: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState(1);
  const [percent, setPercent] = useState(
    durationSeconds ? Math.min(100, Math.round((resumeSeconds / durationSeconds) * 100)) : 0
  );
  const [isComplete, setIsComplete] = useState(completed);
  const lastSaved = useRef(0);

  useEffect(() => {
    const video = videoRef.current;
    if (video && resumeSeconds > 0) video.currentTime = resumeSeconds;
  }, [resumeSeconds]);

  async function saveProgress(currentTime: number, status: "in_progress" | "completed") {
    const duration = videoRef.current?.duration ?? durationSeconds ?? 0;
    const pct = duration ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0;
    setPercent(pct);

    await supabase.from("training_progress").upsert(
      {
        training_id: trainingId,
        user_id: userId,
        status,
        progress_percent: pct,
        last_position_seconds: Math.floor(currentTime),
        completed_at: status === "completed" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "training_id,user_id" }
    );
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    const now = Date.now();
    if (now - lastSaved.current > SAVE_INTERVAL_MS) {
      lastSaved.current = now;
      saveProgress(video.currentTime, "in_progress");
    }
  }

  async function handleEnded() {
    if (!videoRef.current) return;
    setIsComplete(true);
    await saveProgress(videoRef.current.duration, "completed");
    router.refresh();
  }

  async function markComplete() {
    if (!videoRef.current) return;
    setIsComplete(true);
    await saveProgress(videoRef.current.duration || videoRef.current.currentTime, "completed");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <video
        ref={videoRef}
        src={url}
        controls
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onPause={() => videoRef.current && saveProgress(videoRef.current.currentTime, "in_progress")}
        className="w-full rounded-lg bg-black"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Speed</span>
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setSpeed(s);
                if (videoRef.current) videoRef.current.playbackRate = s;
              }}
              className={`rounded-md px-2 py-1 text-xs font-medium ${
                speed === s
                  ? "bg-brand-600 text-white"
                  : "bg-subtle text-gray-600 hover:bg-border dark:bg-subtle-dark dark:text-gray-300"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>

        {isComplete ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
            <CheckCircle2 size={15} /> Completed
          </span>
        ) : (
          <button
            onClick={markComplete}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-subtle dark:border-border-dark dark:hover:bg-subtle-dark"
          >
            <CheckCircle2 size={14} /> Mark complete
          </button>
        )}
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border dark:bg-border-dark">
        <div className="h-full bg-brand-600 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-right text-xs text-gray-400">{percent}% watched</p>
    </div>
  );
}
