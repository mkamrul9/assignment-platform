"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "./auth-context";
import type { AuthUser } from "./types";

type RequireAuthProps = {
  role: AuthUser["role"];
  children: (user: AuthUser) => ReactNode;
};

export function RequireAuth({ role, children }: RequireAuthProps) {
  const router = useRouter();
  const { status, user } = useAuth();

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status === "anonymous" || !user) {
      const next = role === "MENTOR" ? "/mentor" : "/student";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    if (user.role !== role) {
      router.replace(user.role === "MENTOR" ? "/mentor" : "/student");
    }
  }, [status, user, role, router]);

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
