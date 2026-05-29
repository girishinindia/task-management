import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Paperclip,
  Repeat,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: CalendarDays,
    title: "Date-driven scheduling",
    body: "Plan by day, week, or month. Today's view, calendar grid, and overdue badges keep the team focused on what matters now.",
  },
  {
    icon: Users,
    title: "Multi-user assignment",
    body: "Assign one task to many people. Each user gets their own queue, and admins can activate or deactivate users per date.",
  },
  {
    icon: Repeat,
    title: "Frictionless transfers",
    body: "Reassign a task in two clicks with a full audit trail — who moved it, when, and why.",
  },
  {
    icon: Paperclip,
    title: "Rich attachments",
    body: "Attach PDFs, images, videos, or any URL. Files stream through Bunny CDN for fast delivery worldwide.",
  },
  {
    icon: CheckCircle2,
    title: "Status workflow",
    body: "Pending → in progress → done — with a complete history of every transition.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    body: "JWT sessions backed by Redis, bcrypt password hashing, and optional reCAPTCHA on auth flows.",
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen bg-hero-wash">
      {/* Top bar */}
      <header className="glass sticky top-0 z-30 border-b border-border/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <span className="text-base font-semibold tracking-tight">
              Task Portal
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="shadow-soft">
              <Link href="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container relative py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary shadow-soft backdrop-blur">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            Date-based · Multi-user · Built on Next.js &amp; Supabase
          </span>
          <h1 className="mt-7 text-4xl font-bold leading-[1.05] tracking-tight text-foreground md:text-6xl">
            One clean place to{" "}
            <span className="bg-gradient-to-r from-sky-500 to-cyan-400 bg-clip-text text-transparent">
              plan, assign, and ship
            </span>{" "}
            the team&apos;s work.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Task Portal keeps every task tied to a date and the right people.
            Multi-assign, transfer with an audit trail, attach files or links,
            and watch status flow from pending to done.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="shadow-soft">
              <Link href="/signup">
                Create your workspace
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-background/60 backdrop-blur"
            >
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            Invite-only workspaces · no credit card · self-hostable
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="container pb-24">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="group rounded-2xl border border-brand-100/70 bg-card/80 p-6 shadow-soft backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-lg"
            >
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-sky-50 to-sky-100 text-brand-600 ring-1 ring-brand-100 transition-colors group-hover:from-sky-100 group-hover:to-sky-200">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA strip */}
      <section className="container pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500 to-cyan-500 px-8 py-14 text-center shadow-soft-lg">
          <div className="bg-dotted absolute inset-0 opacity-10" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              Ready to get your team organized?
            </h2>
            <p className="mt-3 text-base text-sky-50/90">
              Spin up a workspace in seconds and start assigning work today.
            </p>
            <div className="mt-8 flex justify-center">
              <Button
                asChild
                size="lg"
                className="bg-white text-brand-700 shadow-soft hover:bg-white/90"
              >
                <Link href="/signup">
                  Create your workspace
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-background/60">
        <div className="container flex h-16 items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />© {new Date().getFullYear()} Task Portal
          </span>
          <span>Plan · Assign · Ship</span>
        </div>
      </footer>
    </div>
  );
}
