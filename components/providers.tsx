"use client";

import { PropsWithChildren } from "react";
import { ThemeProvider } from "next-themes";
import { SWRConfig } from "swr";
import { AuthProvider } from "@/components/auth/auth-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: PropsWithChildren) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <SWRConfig
          value={{
            fetcher: (resource: string, init?: RequestInit) =>
              fetch(resource, { cache: "no-cache", ...init }).then(async (response) => {
                if (!response.ok) {
                  const payload = await response.json().catch(() => ({ error: "Request failed" }));
                  throw new Error(payload.error || `HTTP ${response.status}`);
                }
                return response.json();
              }),
            revalidateOnFocus: true,
            refreshWhenOffline: false,
            dedupingInterval: 5000,
            keepPreviousData: true
          }}
        >
          <TooltipProvider>
            {children}
            <Toaster position="bottom-center" />
          </TooltipProvider>
        </SWRConfig>
      </AuthProvider>
    </ThemeProvider>
  );
}
