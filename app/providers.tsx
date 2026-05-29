"use client";

import { ThemeProvider } from "next-themes";

/** Root client providers — wraps the whole app. Today: theme. Future:
 *  query cache, feature flags, etc. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
