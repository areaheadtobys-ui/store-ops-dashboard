"use client";

import { FileSpreadsheet, FileText, Presentation, Download } from "lucide-react";
import type { FileKind } from "@/lib/types";

/**
 * Renders an inline preview for a signed Supabase Storage URL.
 * - PDF: native browser <iframe> viewer (Chrome/Edge/Firefox all render PDFs inline).
 * - image: plain <img>.
 * - pptx/docx/xlsx: embedded via Microsoft Office Online viewer, which needs a
 *   publicly reachable URL — works once deployed, not on localhost. Falls back
 *   to a styled download card until then.
 */
export default function FilePreview({ url, kind, title }: { url: string; kind: FileKind; title: string }) {
  if (kind === "pdf") {
    return (
      <iframe
        src={url}
        title={title}
        className="h-[75vh] w-full rounded-lg border border-border dark:border-border-dark"
      />
    );
  }

  if (kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={title} className="max-h-[75vh] w-full rounded-lg object-contain" />;
  }

  if (kind === "pptx" || kind === "docx" || kind === "xlsx") {
    const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    const isLocalhost = typeof window !== "undefined" && window.location.hostname === "localhost";

    if (!isLocalhost) {
      return (
        <iframe
          src={officeViewerUrl}
          title={title}
          className="h-[75vh] w-full rounded-lg border border-border dark:border-border-dark"
        />
      );
    }
  }

  const Icon = kind === "xlsx" ? FileSpreadsheet : kind === "pptx" ? Presentation : FileText;

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-16 dark:border-border-dark">
      <Icon size={32} className="text-gray-400" />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Preview isn't available for this file type in local development.
      </p>
      <a
        href={url}
        download
        className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        <Download size={14} /> Download to view
      </a>
    </div>
  );
}
