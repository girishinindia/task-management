import { requireUser } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { HotkeyHost } from "@/components/hotkey-host";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // requireUser() redirects to /login if there's no current session,
  // and also checks Redis so revoked tokens are caught even if the cookie
  // hasn't expired yet.
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-hero-wash">
      <SiteHeader user={user} />
      <div className="flex">
        <DashboardSidebar role={user.role} />
        <main className="flex-1 px-4 py-8 md:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
      <HotkeyHost />
    </div>
  );
}
