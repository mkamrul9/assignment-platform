"use client";

import Link from "next/link";

import { useAuth } from "@/features/auth/auth-context";

export function SiteFooter() {
  const { status, user } = useAuth();

  return (
    <footer className="mt-auto border-t border-border bg-card/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>
          <span className="font-semibold text-foreground">ReviewDock</span>
          <span className="mx-2 text-border">·</span>
          Submit projects. Review with clear decisions.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          {status !== "authenticated" ? (
            <>
              <Link href="/login" className="hover:text-foreground">
                Sign in
              </Link>
              <Link href="/signup" className="hover:text-foreground">
                Sign up
              </Link>
            </>
          ) : null}
          {status === "authenticated" && user?.role === "STUDENT" ? (
            <>
              <Link href="/student" className="hover:text-foreground">
                My projects
              </Link>
              <Link href="/student/submit" className="hover:text-foreground">
                Submit
              </Link>
            </>
          ) : null}
          {status === "authenticated" && user?.role === "MENTOR" ? (
            <Link href="/mentor" className="hover:text-foreground">
              Mentor queue
            </Link>
          ) : null}
        </nav>
      </div>
    </footer>
  );
}
