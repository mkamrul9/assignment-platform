"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";

import { useAuth } from "./auth-context";
import type { AuthUser } from "./types";

type RequireAuthProps = {
  role: AuthUser["role"];
  children: (user: AuthUser) => ReactNode;
};

function RequireAuthInner({ role, children }: RequireAuthProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status, user } = useAuth();

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status === "anonymous" || !user) {
      const query = searchParams.toString();
      const returnPath = query ? `${pathname}?${query}` : pathname;
      const next =
        returnPath.startsWith("/student") || returnPath.startsWith("/mentor")
          ? returnPath
          : role === "MENTOR"
            ? "/mentor"
            : "/student";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    if (user.role !== role) {
      router.replace(user.role === "MENTOR" ? "/mentor" : "/student");
    }
  }, [status, user, role, router, pathname, searchParams]);

  if (status === "loading") {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">Checking your session…</p>
      </div>
    );
  }

  if (!user || user.role !== role) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">Redirecting…</p>
      </div>
    );
  }

  return <>{children(user)}</>;
}

export function RequireAuth(props: RequireAuthProps) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-6">
          <p className="text-sm text-muted-foreground">Checking your session…</p>
        </div>
      }
    >
      <RequireAuthInner {...props} />
    </Suspense>
  );
}
