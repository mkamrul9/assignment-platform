"use client";

import { use } from "react";

import { RequireAuth } from "@/features/auth/require-auth";
import { ProjectDetail } from "@/features/submissions/project-detail";

export default function StudentProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <RequireAuth role="STUDENT">
      {() => (
        <section className="max-w-3xl">
          <ProjectDetail key={id} projectId={id} />
        </section>
      )}
    </RequireAuth>
  );
}
