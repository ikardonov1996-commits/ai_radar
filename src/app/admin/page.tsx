import { isAdmin } from "@/lib/admin";
import { adminSummary } from "@/lib/stats";
import { AdminLogin, AdminApps, AdminStats } from "@/components/Admin";

export const metadata = { title: "Админка · AI Radar", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <div className="mx-auto max-w-md p-6">
        <AdminLogin />
      </div>
    );
  }
  const summary = await adminSummary();
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <AdminStats summary={summary} />
      <AdminApps />
    </div>
  );
}
