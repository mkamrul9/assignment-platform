"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/features/auth/require-auth";
import { ProjectList } from "@/features/submissions/project-list";

export default function StudentWorkspacePage() {
  return (
    <RequireAuth role="STUDENT">
      {(user) => (
        <section className="max-w-3xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-wide text-primary">Student workspace</p>
              <h1 className="mt-3 truncate text-3xl font-semibold tracking-tight sm:text-4xl">
                Hello, {user.name}
              </h1>
              <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
                Submit a project and track its review status. Feedback appears after a mentor
                decides.
              </p>
            </div>
            <Button asChild size="lg">
              <Link href="/student/submit">Submit a project</Link>
            </Button>
          </div>

          <div className="mt-10">
            <h2 className="text-sm font-semibold tracking-tight">Your projects</h2>
            <div className="mt-4">
              <ProjectList />
            </div>
          </div>
        </section>
      )}
    </RequireAuth>
  );
}
