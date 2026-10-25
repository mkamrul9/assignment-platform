"use client";

import { Suspense } from "react";

import { AuthForm } from "@/features/auth/auth-form";
import { DemoAccountsPanel } from "@/features/auth/demo-accounts-panel";

export function SignupPageClient() {
  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <div className="rounded-xl border border-border bg-card px-6 py-8 sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight">Create a student account</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Public signup creates a student workspace. Mentors are seeded separately.
        </p>
        <div className="mt-8">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading form…</p>}>
            <AuthForm mode="signup" />
          </Suspense>
        </div>
      </div>
      <DemoAccountsPanel mode="signup" />
    </div>
  );
}
