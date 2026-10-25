import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthForm } from "@/features/auth/auth-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-card px-6 py-8 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Sign in with your student or mentor account to open your workspace.
      </p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading form…</p>}>
          <AuthForm mode="login" />
        </Suspense>
      </div>
    </div>
  );
}
