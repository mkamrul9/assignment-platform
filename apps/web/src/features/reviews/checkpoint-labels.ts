import type { CheckpointAssessment } from "./types";

export const CHECKPOINT_FIELDS = [
  { key: "functionality", label: "Functionality" },
  { key: "usability", label: "Usability" },
  { key: "documentation", label: "Documentation" },
] as const;

export type CheckpointFieldKey = (typeof CHECKPOINT_FIELDS)[number]["key"];

export const CHECKPOINT_OPTIONS: Array<{
  value: CheckpointAssessment;
  label: string;
}> = [
  { value: "MEETS_EXPECTATIONS", label: "Meets expectations" },
  { value: "NEEDS_IMPROVEMENT", label: "Needs improvement" },
  { value: "NOT_ASSESSED", label: "Not assessed" },
];

export function checkpointLabel(value: CheckpointAssessment): string {
  return CHECKPOINT_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
