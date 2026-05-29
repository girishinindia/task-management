import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Reset password" };
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <Card className="border-brand-100/80 shadow-soft-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Reset password</CardTitle>
        <CardDescription>
          Enter your email and an admin will be notified to set a new temporary
          password for you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Remembered it?
        <Link
          href="/login"
          className="ml-1 font-medium text-primary hover:underline"
        >
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
