"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Dashboard error boundary — keeps the sidebar + header rendered above
 *  while the inner area shows the failure. */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[dashboard error boundary]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-lg border bg-card p-8 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">
          Couldn&apos;t load this page
        </h2>
        <p className="text-sm text-muted-foreground">
          A server or network error stopped us from finishing the request.
        </p>
        {error.digest ? (
          <p className="text-[10px] text-muted-foreground">
            Reference: <code>{error.digest}</code>
          </p>
        ) : null}
      </div>
      <Button onClick={reset} variant="outline">
        <RefreshCcw className="h-3.5 w-3.5" /> Try again
      </Button>
    </div>
  );
}
