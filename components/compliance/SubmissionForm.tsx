"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, File as FileIcon, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { FileKind } from "@/lib/types";

const EXT_TO_KIND: Record<string, FileKind> = {
  pdf: "pdf",
  xls: "xlsx",
  xlsx: "xlsx",
  png: "image",
  jpg: "image",
  jpeg: "image",
  mp4: "video",
  mov: "video",
};

export default function SubmissionForm({
  categories,
  branches,
}: {
  categories: { id: string; name: string }[];
  branches: { id: string; name: string }[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    setFiles((prev) => [...prev, ...Array.from(incoming)]);
  }, []);

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId || !branchId) {
      setError("Choose a category and branch.");
      return;
    }
    if (files.length === 0) {
      setError("Attach at least one file (photo, PDF, video, or Excel).");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { data: submission, error: insertError } = await supabase
        .from("compliance_submissions")
        .insert({
          category_id: categoryId,
          branch_id: branchId,
          submitted_by: user.id,
          status: "submitted",
          due_date: dueDate || null,
          submitted_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      for (const file of files) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        const kind = EXT_TO_KIND[ext] ?? "other";
        const path = `${submission.id}/${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("compliance-files")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;

        const { error: attachError } = await supabase.from("compliance_attachments").insert({
          submission_id: submission.id,
          file_path: path,
          file_kind: kind,
        });
        if (attachError) throw attachError;
      }

      router.push(`/compliance/${submission.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Category" required>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Branch" required>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="input">
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Due date">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
        </Field>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Attachments <span className="text-red-500">*</span>
        </label>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition ${
            dragOver ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20" : "border-border dark:border-border-dark"
          }`}
        >
          <UploadCloud size={24} className="text-gray-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Drag and drop, or{" "}
            <label className="cursor-pointer text-brand-600 hover:underline">
              browse
              <input
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.xls,.xlsx,.png,.jpg,.jpeg,.mp4,.mov"
                onChange={(e) => addFiles(e.target.files)}
              />
            </label>
          </p>
          <p className="text-xs text-gray-400">PDF, Excel, photos, or video — multiple files allowed</p>
        </div>

        {files.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {files.map((f, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-xs dark:border-border-dark"
              >
                <span className="flex items-center gap-1.5">
                  <FileIcon size={12} /> {f.name}
                </span>
                <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500">
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit for review"}
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
