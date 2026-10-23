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
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
                Student workspace
              </p>
              <h1 className="mt-4 font-serif text-4xl tracking-tight">Hello, {user.name}</h1>
              <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
                Submit a project for review and track its status here. Feedback appears once a
                mentor decides.
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
