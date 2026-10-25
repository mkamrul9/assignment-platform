import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell mainClassName="mx-auto flex w-full max-w-6xl flex-1 items-start justify-center px-4 py-10 sm:px-8 sm:py-16">
      {children}
    </AppShell>
  );
}
