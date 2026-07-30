"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Building2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-subtle px-4 dark:bg-subtle-dark">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Building2 size={22} />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Store Operations Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Sign in to your account</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-surface p-6 shadow-card dark:border-border-dark dark:bg-surface-dark"
        >
          {error && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Work email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-border-dark"
            placeholder="you@company.com"
          />

          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs text-brand-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-6 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-border-dark"
            placeholder="••••••••"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-600 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Access is provisioned by your administrator. Contact your Area Head if you need an account.
        </p>
      </div>
    </div>
  );
}
