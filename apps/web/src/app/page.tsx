import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";

const workflow = [
  {
    title: "Submit a project",
    description: "Students share a repository, live demo, and short description for mentor review.",
  },
  {
    title: "Review the queue",
    description:
      "Mentors filter, search, and paginate pending work, then approve or reject with notes.",
  },
  {
    title: "See the outcome",
    description: "Students get a clear status, optional checkpoints, and actionable feedback.",
  },
];

export default function HomePage() {
  return (
    <AppShell mainClassName="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-8 sm:py-14">
      <section className="max-w-2xl">
        <p className="text-sm font-semibold tracking-wide text-primary">Project review workspace</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          ReviewDock helps students submit projects and mentors decide with clear feedback.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
          Sign up as a student to submit work, or sign in with a seeded mentor account to manage the
          review queue.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/signup">Create a student account</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </section>

      <section
        id="workflow"
        aria-label="How ReviewDock works"
        className="mt-16 grid gap-8 border-t border-border pt-10 sm:grid-cols-3 sm:gap-10"
      >
        {workflow.map((step, index) => (
          <article key={step.title}>
            <p className="text-xs font-semibold tracking-wide text-accent-foreground uppercase">
              Step {index + 1}
            </p>
            <h2 className="mt-3 text-lg font-semibold tracking-tight">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
