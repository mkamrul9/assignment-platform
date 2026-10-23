import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 sm:px-10">
      <header className="flex items-center justify-between gap-4 border-b py-7">
        <Link href="/" aria-label="ReviewDock home" className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-semibold text-white"
          >
            rd.
          </span>
          <span className="text-lg font-semibold tracking-tight">ReviewDock</span>
        </Link>
        <span className="text-xs text-muted-foreground sm:text-sm">Work, meet perspective.</span>
      </header>
      <main className="flex flex-1 items-start justify-center py-16 sm:py-24">{children}</main>
    </div>
  );
}
