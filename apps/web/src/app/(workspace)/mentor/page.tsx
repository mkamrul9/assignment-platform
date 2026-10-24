"use client";

import { Suspense } from "react";

import { RequireAuth } from "@/features/auth/require-auth";
import { MentorQueue } from "@/features/reviews/mentor-queue";

export default function MentorWorkspacePage() {
  return (
    <RequireAuth role="MENTOR">
      {(user) => (
        <section className="min-w-0 max-w-6xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            Mentor workspace
          </p>
          <h1 className="mt-4 font-serif text-4xl tracking-tight">Hello, {user.name}</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            Review pending student projects, leave a clear decision with optional checkpoints, and
            search the queue. Filters and search change the table only — the cards stay global.
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
