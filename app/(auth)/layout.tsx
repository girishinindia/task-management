import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // If somebody who's already signed in lands on /login or /signup,
  // bounce them to the dashboard.
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="bg-hero-wash relative min-h-screen">
      <header className="glass sticky top-0 z-30 border-b border-border/60">
        <div className="container flex h-16 items-center">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <span className="text-base font-semibold tracking-tight">
              Task Portal
            </span>
          </Link>
        </div>
      </header>
      <main className="container flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
