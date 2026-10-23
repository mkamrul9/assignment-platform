import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthForm } from "@/features/auth/auth-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="w-full max-w-md rounded-xl border bg-card px-6 py-8 shadow-xs sm:px-8">
      <h1 className="font-serif text-3xl tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Sign in as a student or mentor to continue.
      </p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading form…</p>}>
          <AuthForm mode="login" />
        </Suspense>
      </div>
    </div>
  );
}
