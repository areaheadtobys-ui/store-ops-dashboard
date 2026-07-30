"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/settings/change-password`,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-subtle px-4 dark:bg-subtle-dark">
      <div className="w-full max-w-sm">
        <Link
          href="/login"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
        >
          <ArrowLeft size={14} /> Back to login
        </Link>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-card dark:border-border-dark dark:bg-surface-dark">
          <h1 className="mb-1 text-base font-semibold">Reset your password</h1>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            We'll email you a link to choose a new password.
          </p>

          {sent ? (
            <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
              Check your inbox for a reset link.
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                  {error}
                </div>
              )}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="mb-4 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-border-dark"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
