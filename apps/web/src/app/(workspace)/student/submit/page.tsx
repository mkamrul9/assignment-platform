"use client";

import { RequireAuth } from "@/features/auth/require-auth";
import { SubmissionForm } from "@/features/submissions/submission-form";

export default function StudentSubmitPage() {
  return (
    <RequireAuth role="STUDENT">
      {() => (
        <section className="mx-auto w-full max-w-xl">
          <p className="text-sm font-semibold tracking-wide text-primary">New submission</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Share your project
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Provide the repository, a live demo, and a short description. A draft is saved on this
            device while you work.
          </p>
          <div className="mt-8 rounded-xl border border-border bg-card px-6 py-8 sm:px-8">
            <SubmissionForm />
          </div>
        </section>
      )}
    </RequireAuth>
  );
}
