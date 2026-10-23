"use client";

import { RequireAuth } from "@/features/auth/require-auth";

export default function StudentWorkspacePage() {
  return (
    <RequireAuth role="STUDENT">
      {(user) => (
        <section className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            Student workspace
          </p>
          <h1 className="mt-4 font-serif text-4xl tracking-tight">Hello, {user.name}</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            You are signed in as <span className="text-foreground">{user.email}</span>. Project
            submission tools arrive in a later phase. This page confirms your session survives
            reload and stays limited to student access.
          </p>
        </section>
      )}
    </RequireAuth>
  );
}
