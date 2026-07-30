import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user?.id).single();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Your profile information.</p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-card dark:border-border-dark dark:bg-surface-dark">
        <dl className="space-y-3 text-sm">
          <Row label="Full name" value={profile?.full_name ?? "—"} />
          <Row label="Email" value={profile?.email ?? "—"} />
          <Row label="Role" value={profile?.role?.replace("_", " ") ?? "—"} />
        </dl>
      </div>

      <p className="text-xs text-gray-400">
        Change-password and avatar-upload forms are the next additions here — both are simple wrappers
        around <code>supabase.auth.updateUser()</code> and the <code>avatars</code> storage bucket.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border pb-2 last:border-0 dark:border-border-dark">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}
