"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  children,
  onNavigate,
}: {
  href: string;
  children: ReactNode;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

export function SiteNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPathname, setMenuPathname] = useState(pathname);
  const menuId = useId();

  if (menuPathname !== pathname) {
    setMenuPathname(pathname);
    setMenuOpen(false);
  }

  async function onLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      setMenuOpen(false);
      router.replace("/login");
    } catch {
      setLogoutError("Unable to log out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }

  const workspaceHref = user?.role === "MENTOR" ? "/mentor" : "/student";
  const workspaceLabel = user?.role === "MENTOR" ? "Mentor queue" : "My projects";

  const publicLinks = (
    <>
      <NavLink href="/login" onNavigate={() => setMenuOpen(false)}>
        Sign in
      </NavLink>
      <Button asChild size="sm" className="sm:ml-1">
        <Link href="/signup" onClick={() => setMenuOpen(false)}>
          Sign up
        </Link>
      </Button>
    </>
  );

  const authenticatedLinks = user ? (
    <>
      <NavLink href={workspaceHref} onNavigate={() => setMenuOpen(false)}>
        {workspaceLabel}
      </NavLink>
      {user.role === "STUDENT" ? (
        <NavLink href="/student/submit" onNavigate={() => setMenuOpen(false)}>
          Submit
        </NavLink>
      ) : null}
      <span className="hidden truncate text-sm text-muted-foreground md:inline md:max-w-[12rem]">
        {user.name}
      </span>
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
  ) : null;

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <Link
          href="/"
          aria-label="ReviewDock home"
          className="flex min-w-0 items-center gap-2.5"
          onClick={() => setMenuOpen(false)}
        >
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-xs font-bold tracking-wide text-primary-foreground"
          >
            RD
          </span>
          <span className="truncate text-lg font-semibold tracking-tight text-foreground">
            ReviewDock
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {status === "loading" ? (
            <span className="px-3 text-sm text-muted-foreground">Checking session…</span>
          ) : null}
          {status === "anonymous" ? publicLinks : null}
          {status === "authenticated" ? authenticatedLinks : null}
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          {status === "authenticated" && user ? (
            <NavLink href={workspaceHref} onNavigate={() => setMenuOpen(false)}>
              {workspaceLabel}
            </NavLink>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? "Close" : "Menu"}
          </Button>
        </div>
      </div>

      {menuOpen ? (
        <nav id={menuId} aria-label="Mobile" className="border-t border-border bg-card md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-8">
            {status === "loading" ? (
              <span className="px-3 py-2 text-sm text-muted-foreground">Checking session…</span>
            ) : null}
            {status === "anonymous" ? (
              <div className="flex flex-col gap-1">{publicLinks}</div>
            ) : null}
            {status === "authenticated" && user ? (
              <div className="flex flex-col gap-1">
                <NavLink href={workspaceHref} onNavigate={() => setMenuOpen(false)}>
                  {workspaceLabel}
                </NavLink>
                {user.role === "STUDENT" ? (
                  <NavLink href="/student/submit" onNavigate={() => setMenuOpen(false)}>
                    Submit a project
                  </NavLink>
                ) : null}
                <p className="truncate px-3 py-2 text-sm text-muted-foreground">{user.name}</p>
                <div className="px-1 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={loggingOut}
                    onClick={() => void onLogout()}
                  >
                    {loggingOut ? "Logging out…" : "Log out"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </nav>
      ) : null}

      {logoutError ? (
        <p role="alert" className="mx-auto max-w-6xl px-4 pb-3 text-sm text-destructive sm:px-8">
          {logoutError}
        </p>
      ) : null}
    </header>
  );
}
