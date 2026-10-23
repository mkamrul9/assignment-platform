"use client";

import { RequireAuth } from "@/features/auth/require-auth";
import { SubmissionForm } from "@/features/submissions/submission-form";

export default function StudentSubmitPage() {
  return (
    <RequireAuth role="STUDENT">
      {() => (
        <section className="mx-auto w-full max-w-xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            New submission
          </p>
          <h1 className="mt-4 font-serif text-4xl tracking-tight">Share your project</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Provide the repository, a live demo, and a short description. Mentors review pending
            projects in a later phase.
          </p>
          <div className="mt-8 rounded-xl border bg-card px-6 py-8 shadow-xs sm:px-8">
            <SubmissionForm />
          </div>
        </section>
      )}
    </RequireAuth>
  );
}
