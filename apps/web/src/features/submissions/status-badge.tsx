import { cn } from "@/lib/utils";

import type { Submission } from "./types";

const STATUS_STYLES: Record<Submission["status"], { label: string; className: string }> = {
  PENDING: {
    label: "Pending review",
    className: "bg-accent text-accent-foreground",
  },
  APPROVED: {
    label: "Approved",
    className: "bg-success/15 text-success-foreground",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-destructive/10 text-destructive",
  },
};

export function StatusBadge({ status }: { status: Submission["status"] }) {
  const style = STATUS_STYLES[status] ?? {
    label: status,
    className: "bg-secondary text-secondary-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex max-w-full truncate rounded-md px-2.5 py-1 text-xs font-medium",
        style.className,
      )}
    >
      {style.label}
    </span>
  );
}
