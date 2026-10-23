import Link from "next/link";

import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";

const workflow = [
  {
    number: "01",
    title: "Bring your work.",
    description:
      "A repository, a live demo, and the story behind what you built. One place for all of it.",
  },
  {
    number: "02",
    title: "Give it a thoughtful review.",
    description:
      "A focused queue helps mentors see what needs attention and make a clear decision.",
  },
  {
    number: "03",
    title: "Know where you stand.",
    description:
      "A visible status and useful feedback keep students from wondering what happens next.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 sm:px-10">
      <a
        href="#main"
        className="sr-only z-10 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-4"
      >
        Skip to content
      </a>

      <SiteHeader />

      <main id="main" className="flex-1">
        <section className="max-w-3xl py-20 sm:py-28">
          <p className="mb-7 text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            Student projects. Thoughtful feedback.
          </p>
          <h1 className="max-w-2xl font-serif text-5xl leading-[1.08] tracking-tight sm:text-7xl">
            Good work deserves a clear next step.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">
            A shared space for students to submit what they have built, and for mentors to help move
            it forward.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
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
          className="grid scroll-mt-8 gap-8 border-t py-10 sm:grid-cols-3 sm:gap-10"
        >
          {workflow.map((step) => (
            <article key={step.number}>
              <span className="font-mono text-xs text-primary">{step.number} /</span>
              <h2 className="mt-4 text-lg font-semibold tracking-tight">{step.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.description}</p>
            </article>
          ))}
        </section>

        <p className="mb-12 rounded-lg border bg-card px-5 py-4 text-sm leading-6 text-muted-foreground">
          Accounts are ready. Submission and review tools will be available here in later phases.
        </p>
      </main>

      <footer className="flex flex-wrap justify-between gap-3 border-t py-6 text-xs text-muted-foreground">
        <span>ReviewDock</span>
        <span>A little structure. A better review.</span>
      </footer>
    </div>
  );
}
