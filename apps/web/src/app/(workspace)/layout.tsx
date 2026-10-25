import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell mainClassName="mx-auto w-full max-w-6xl min-w-0 flex-1 overflow-x-hidden px-4 py-8 sm:px-8 sm:py-10">
      {children}
    </AppShell>
  );
}
