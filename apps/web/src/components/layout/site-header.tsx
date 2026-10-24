"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";

export function SiteHeader() {
  const router = useRouter();
  const { status, user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function onLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      router.replace("/login");
    } catch {
      setLogoutError("Unable to log out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b py-7">
      <Link href="/" aria-label="ReviewDock home" className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-semibold text-white"
        >
          rd.
        </span>
        <span className="text-lg font-semibold tracking-tight">ReviewDock</span>
      </Link>

      <nav aria-label="Account" className="flex items-center gap-2 sm:gap-3">
        {status === "loading" ? (
          <span className="text-xs text-muted-foreground sm:text-sm">Checking session…</span>
        ) : null}

        {status === "anonymous" ? (
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Sign up</Link>
            </Button>
          </>
        ) : null}

        {status === "authenticated" && user ? (
          <>
            {user.role === "STUDENT" ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/student/submit">Submit</Link>
              </Button>
            ) : null}
            <Link
              href={user.role === "MENTOR" ? "/mentor" : "/student"}
              className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
            >
              {user.name}
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loggingOut}
              onClick={() => void onLogout()}
            >
              {loggingOut ? "Logging out…" : "Log out"}
            </Button>
          </>
        ) : null}
      </nav>
      {logoutError ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {logoutError}
        </p>
      ) : null}
    </header>
  );
}
