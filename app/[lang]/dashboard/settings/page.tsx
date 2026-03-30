import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserByEmail } from "@/lib/data-access";
import { type Locale } from "@/lib/i18n/config";
import { AccountSettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function DashboardSettingsPage({
  params,
}: {
  params: { lang: Locale };
}) {
  let session;
  try {
    session = await getSession();
  } catch (error) {
    console.error("Failed to load session for settings page:", error);
    redirect(`/${params.lang}/sign-in`);
  }

  if (!session?.user?.email) {
    redirect(`/${params.lang}/sign-in`);
  }

  let user;
  try {
    user = await getUserByEmail(session.user.email);
  } catch (error) {
    console.error("Failed to fetch user for settings page:", error);
    user = null;
  }

  if (!user) {
    redirect(`/${params.lang}/dashboard`);
  }

  return (
    <div className="dashboard-shell min-h-screen bg-background">
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6 lg:p-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-300">Dashboard</p>
          <h1 className="text-2xl font-semibold text-zinc-100 md:text-3xl">Account Settings</h1>
          <p className="text-sm text-slate-300">Update your profile details and password.</p>
        </header>

        <AccountSettingsForm initialName={user.name} email={user.email} />
      </div>
    </div>
  );
}
