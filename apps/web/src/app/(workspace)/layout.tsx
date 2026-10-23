import type { ReactNode } from "react";

import { SiteHeader } from "@/components/layout/site-header";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 sm:px-10">
      <SiteHeader />
      <main className="flex-1 py-10 sm:py-14">{children}</main>
    </div>
  );
}
