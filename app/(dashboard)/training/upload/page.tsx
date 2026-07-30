import UploadForm from "@/components/training/UploadModal";

export default function UploadTrainingPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Upload training</h1>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        Supported formats: PDF, PowerPoint, Word, Excel, images, and MP4 video. Video files are
        automatically routed to Video Training.
      </p>
      <div className="rounded-xl border border-border bg-surface p-6 shadow-card dark:border-border-dark dark:bg-surface-dark">
        <UploadForm />
      </div>
    </div>
  );
}
