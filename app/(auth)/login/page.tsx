import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };
// useSearchParams inside LoginForm needs request-time rendering. The parent
// (auth)/layout already calls cookies() so this is dynamic anyway — making it
// explicit avoids any build-time static-analysis surprises.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Card className="border-brand-100/80 shadow-soft-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>
          Sign in to manage your team&apos;s tasks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Don&apos;t have an account?
        <Link
          href="/signup"
          className="ml-1 font-medium text-primary hover:underline"
        >
          Create one
        </Link>
      </CardFooter>
    </Card>
  );
}
