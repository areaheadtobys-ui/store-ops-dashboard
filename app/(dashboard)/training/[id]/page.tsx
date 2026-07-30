import { notFound } from "next/navigation";
import { Download, Calendar, User, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import FilePreview from "@/components/training/FilePreview";
import ProgressActions from "@/components/training/ProgressActions";
import type { TrainingModule, TrainingStatus } from "@/lib/types";

export default async function TrainingDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: training } = await supabase
    .from("training_modules")
    .select("*")
    .eq("id", params.id)
    .single<TrainingModule>();

  if (!training) notFound();

  const { data: progress } = await supabase
    .from("training_progress")
    .select("status")
    .eq("training_id", training.id)
    .eq("user_id", user?.id)
    .maybeSingle();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id")
    .eq("training_id", training.id)
    .maybeSingle();

  const { data: signed } = await supabase.storage
    .from("training-files")
    .createSignedUrl(training.file_path, 60 * 60);

  const { data: author } = training.author_id
    ? await supabase.from("profiles").select("full_name").eq("id", training.author_id).single()
    : { data: null };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h1 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{training.title}</h1>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">{training.description}</p>

        {signed?.signedUrl ? (
          <FilePreview url={signed.signedUrl} kind={training.file_kind} title={training.title} />
        ) : (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-gray-400 dark:border-border-dark">
            File not found in storage. Ask an admin to re-upload this module.
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card dark:border-border-dark dark:bg-surface-dark">
          <h2 className="mb-3 text-sm font-semibold">Your progress</h2>
          {user && (
            <ProgressActions
              trainingId={training.id}
              userId={user.id}
              initialStatus={(progress?.status as TrainingStatus) ?? "not_started"}
              hasQuiz={!!quiz}
            />
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-card dark:border-border-dark dark:bg-surface-dark">
          <h2 className="mb-3 text-sm font-semibold">Details</h2>
          <dl className="space-y-2.5 text-xs">
            <Row icon={Layers} label="Category" value={training.category ?? "General"} />
            <Row icon={User} label="Author" value={author?.full_name ?? "—"} />
            <Row icon={Calendar} label="Uploaded" value={new Date(training.created_at).toLocaleDateString()} />
            <Row icon={Calendar} label="Expires" value={training.expiration_date ? new Date(training.expiration_date).toLocaleDateString() : "No expiry"} />
            <Row icon={Layers} label="Version" value={training.version} />
          </dl>

          {signed?.signedUrl && (
            <a
              href={signed.signedUrl}
              download
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-md border border-border py-2 text-sm font-medium hover:bg-subtle dark:border-border-dark dark:hover:bg-subtle-dark"
            >
              <Download size={14} /> Download
            </a>
          )}
        </div>

        {quiz && (
          <a
            href={`/quizzes/${quiz.id}`}
            className="block rounded-xl border border-brand-200 bg-brand-50 p-4 text-center text-sm font-medium text-brand-700 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-300"
          >
            Take the certification quiz →
          </a>
        )}
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
        <Icon size={12} /> {label}
      </span>
      <span className="font-medium text-gray-800 dark:text-gray-200">{value}</span>
    </div>
  );
}
