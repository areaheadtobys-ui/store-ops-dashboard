import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function UsersPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (!me || (me.role !== "super_admin" && me.role !== "area_head")) redirect("/dashboard");

  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active, branches(name)")
    .order("full_name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Users</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Manage accounts, roles, and branch assignments.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card dark:border-border-dark dark:bg-surface-dark">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-subtle text-left text-xs uppercase text-gray-500 dark:border-border-dark dark:bg-subtle-dark dark:text-gray-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Branch</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border dark:divide-border-dark">
            {(users ?? []).map((u: any) => (
              <tr key={u.id}>
                <td className="px-4 py-2.5 font-medium">{u.full_name}</td>
                <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{u.email}</td>
                <td className="px-4 py-2.5 capitalize">{u.role.replace("_", " ")}</td>
                <td className="px-4 py-2.5">{u.branches?.name ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={
                      u.is_active
                        ? "rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-950 dark:text-green-300"
                        : "rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800"
                    }
                  >
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        Row actions (edit role, deactivate, reset password) call Supabase admin APIs and need a server
        route using the service-role key — never expose that key to the browser.
      </p>
    </div>
  );
}
