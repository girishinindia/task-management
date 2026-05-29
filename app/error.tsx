"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Root-level error boundary. Triggered by uncaught errors in server or
 *  client components that don't have a closer error.tsx. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[root error boundary]", error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground">
            We hit an unexpected error. Try again, and if it keeps happening
            let your admin know.
          </p>
          {error.digest ? (
            <p className="text-[10px] text-muted-foreground">
              Error reference: <code>{error.digest}</code>
            </p>
          ) : null}
        </div>
        <Button onClick={reset} variant="outline">
          <RefreshCcw className="h-3.5 w-3.5" /> Try again
        </Button>
      </div>
    </div>
  );
}
