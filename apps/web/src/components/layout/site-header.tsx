"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";

export function SiteHeader() {
  const router = useRouter();
  const { status, user, logout } = useAuth();

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  return (
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
            <Link
              href={user.role === "MENTOR" ? "/mentor" : "/student"}
              className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
            >
              {user.name}
            </Link>
            <Button type="button" variant="outline" size="sm" onClick={() => void onLogout()}>
              Log out
            </Button>
          </>
        ) : null}
      </nav>
    </header>
  );
}
