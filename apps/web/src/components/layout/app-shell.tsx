import type { ReactNode } from "react";

import { SiteFooter } from "./site-footer";
import { SiteNavbar } from "./site-navbar";

/** Shared chrome for public, auth, and workspace routes — one navbar/footer pair. */
export function AppShell({
  children,
  mainClassName,
}: {
  children: ReactNode;
  mainClassName?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main"
        className="sr-only z-20 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <SiteNavbar />
      <main
        id="main"
        className={
          mainClassName ?? "mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 py-8 sm:px-8 sm:py-10"
        }
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
