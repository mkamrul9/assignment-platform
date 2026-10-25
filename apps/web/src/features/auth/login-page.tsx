"use client";

import { Suspense, useState } from "react";

import { AuthForm, type AuthFormCredentials } from "@/features/auth/auth-form";
import { DemoAccountsPanel, type DemoAccountOption } from "@/features/auth/demo-accounts-panel";

export function LoginPageClient() {
  const [prefill, setPrefill] = useState<AuthFormCredentials | null>(null);

  function onSelectAccount(account: DemoAccountOption) {
    setPrefill({ email: account.email, password: account.password, autoSubmit: true });
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <div className="rounded-xl border border-border bg-card px-6 py-8 sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Sign in with your student or mentor account to open your workspace.
        </p>
        <div className="mt-8">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading form…</p>}>
            <AuthForm mode="login" prefill={prefill} />
          </Suspense>
        </div>
      </div>
      <DemoAccountsPanel mode="login" onSelectAccount={onSelectAccount} />
    </div>
  );
}
