"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, File as FileIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { FileKind } from "@/lib/types";

const EXT_TO_KIND: Record<string, FileKind> = {
  pdf: "pdf",
  ppt: "pptx",
  pptx: "pptx",
  doc: "docx",
  docx: "docx",
  xls: "xlsx",
  xlsx: "xlsx",
  png: "image",
  jpg: "image",
  jpeg: "image",
  mp4: "video",
  mov: "video",
};

export default function UploadForm() {
  const supabase = createClient();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    estimated_duration_minutes: "",
    expiration_date: "",
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    setUploading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const kind = EXT_TO_KIND[ext] ?? "other";
      const isVideo = kind === "video";
      const path = `${user.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("training-files")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("training_modules").insert({
        title: form.title,
        description: form.description || null,
        category: form.category || null,
        file_kind: kind,
        file_path: path,
        version: "1.0",
        author_id: user.id,
        estimated_duration_minutes: form.estimated_duration_minutes
          ? Number(form.estimated_duration_minutes)
          : null,
        expiration_date: form.expiration_date || null,
        is_video: isVideo,
      });
      if (insertError) throw insertError;

      router.push(isVideo ? "/video-training" : "/training");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition ${
          dragOver ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20" : "border-border dark:border-border-dark"
        }`}
      >
        {file ? (
          <>
            <FileIcon size={28} className="text-brand-600" />
            <p className="text-sm font-medium">{file.name}</p>
            <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </>
        ) : (
          <>
            <UploadCloud size={28} className="text-gray-400" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Drag and drop a file, or{" "}
              <label className="cursor-pointer text-brand-600 hover:underline">
                browse
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.mp4,.mov"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </p>
            <p className="text-xs text-gray-400">PDF, PPTX, DOCX, XLSX, images, or MP4</p>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Title" required>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Category">
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="input"
            placeholder="e.g. Onboarding, Safety"
          />
        </Field>
        <Field label="Estimated duration (minutes)">
          <input
            type="number"
            value={form.estimated_duration_minutes}
            onChange={(e) => setForm({ ...form, estimated_duration_minutes: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Expiration date">
          <input
            type="date"
            value={form.expiration_date}
            onChange={(e) => setForm({ ...form, expiration_date: e.target.value })}
            className="input"
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="input min-h-[80px]"
        />
      </Field>

      <button
        type="submit"
        disabled={uploading}
        className="w-full rounded-md bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {uploading ? "Uploading…" : "Publish training module"}
      </button>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid rgb(228 231 236);
          background: transparent;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus {
          border-color: #3b74f0;
        }
        .dark .input {
          border-color: #242c3d;
        }
      `}</style>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
