"use client";

import { Suspense } from "react";

import { RequireAuth } from "@/features/auth/require-auth";
import { MentorQueue } from "@/features/reviews/mentor-queue";

export default function MentorWorkspacePage() {
  return (
    <RequireAuth role="MENTOR">
      {(user) => (
        <section className="min-w-0 max-w-6xl">
          <p className="text-sm font-semibold tracking-wide text-primary">Mentor workspace</p>
          <h1 className="mt-3 truncate text-3xl font-semibold tracking-tight sm:text-4xl">
            Hello, {user.name}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            Filter and search the queue, then approve or reject pending projects. Summary totals
            stay global; filters only change the table.
          </p>
          <div className="mt-10">
            <Suspense
              fallback={<p className="text-sm text-muted-foreground">Loading the queue…</p>}
            >
              <MentorQueue />
            </Suspense>
          </div>
        </section>
      )}
    </RequireAuth>
  );
}
