import type { ReactNode } from "react";

import { SiteHeader } from "@/components/layout/site-header";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl min-w-0 flex-col overflow-x-hidden px-6 sm:px-10">
      <SiteHeader />
      <main className="min-w-0 flex-1 py-10 sm:py-14">{children}</main>
    </div>
  );
}
