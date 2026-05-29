"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { signupSchema, type SignupInput } from "@/lib/schemas/auth";
import { useRecaptcha } from "@/lib/captcha-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

export function SignupForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const { execute: executeCaptcha, enabled: captchaEnabled } = useRecaptcha();

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      confirm_password: "",
    },
  });

  async function onSubmit(data: SignupInput) {
    setServerError(null);
    const captcha_token = captchaEnabled
      ? await executeCaptcha("signup")
      : undefined;

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...data, captcha_token }),
    });

    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as
        | { error?: { message?: string; code?: string } }
        | null;
      if (payload?.error?.code === "email_taken") {
        form.setError("email", {
          message: "An account with this email already exists.",
        });
      } else {
        setServerError(
          payload?.error?.message ?? "Something went wrong. Try again."
        );
      }
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {serverError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="full_name">Full name</Label>
        <Input
          id="full_name"
          autoComplete="name"
          {...form.register("full_name")}
        />
        {form.formState.errors.full_name ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.full_name.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.password.message}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            At least 8 characters, including a number.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm_password">Confirm password</Label>
        <PasswordInput
          id="confirm_password"
          autoComplete="new-password"
          {...form.register("confirm_password")}
        />
        {form.formState.errors.confirm_password ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.confirm_password.message}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        Create account
      </Button>

      {captchaEnabled ? (
        <p className="text-center text-[11px] text-muted-foreground">
          Protected by reCAPTCHA.
        </p>
      ) : null}
    </form>
  );
}
