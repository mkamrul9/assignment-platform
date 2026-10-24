import { z } from "zod";

import { CheckpointAssessment, ReviewDecision } from "../../generated/prisma/client.js";

const QUEUE_STATUSES = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const;

/** Maximum length for mentor queue search `q` after trim. */
export const QUEUE_SEARCH_MAX_LENGTH = 100;

const checkpointValue = z.enum([
  CheckpointAssessment.MEETS_EXPECTATIONS,
  CheckpointAssessment.NEEDS_IMPROVEMENT,
  CheckpointAssessment.NOT_ASSESSED,
]);

const positiveInt = (label: string, max?: number) =>
  z.coerce
    .number()
    .int(`${label} must be a whole number.`)
    .positive(`${label} must be a positive integer.`)
    .refine((value) => Number.isSafeInteger(value), {
      message: `${label} is out of range.`,
    })
    .refine((value) => (max === undefined ? true : value <= max), {
      message: max ? `${label} must be at most ${max}.` : `${label} is invalid.`,
    });

export const queueQuerySchema = z
  .object({
    page: positiveInt("page").default(1),
    pageSize: positiveInt("pageSize", 50).default(10),
    status: z.enum(QUEUE_STATUSES).default("PENDING"),
    q: z
      .string()
      .optional()
      .transform((value) => {
        if (value === undefined) {
          return undefined;
        }
        const trimmed = value.trim();
        return trimmed.length === 0 ? undefined : trimmed;
      })
      .refine((value) => value === undefined || value.length <= QUEUE_SEARCH_MAX_LENGTH, {
        message: `q must be at most ${QUEUE_SEARCH_MAX_LENGTH} characters.`,
      }),
  })
  .strict();

const checkpointsSchema = z
  .object({
    functionality: checkpointValue.optional(),
    usability: checkpointValue.optional(),
    documentation: checkpointValue.optional(),
  })
  .strict()
  .optional();

export const decisionBodySchema = z
  .object({
    decision: z.enum([ReviewDecision.APPROVED, ReviewDecision.REJECTED]),
    note: z.string().optional(),
    checkpoints: checkpointsSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const trimmed = value.note?.trim() ?? "";

    if (value.decision === ReviewDecision.REJECTED) {
      if (trimmed.length < 10) {
        ctx.addIssue({
          code: "custom",
          path: ["note"],
          message: "Rejection requires a note of at least 10 characters.",
        });
      }
      if (trimmed.length > 1000) {
        ctx.addIssue({
          code: "custom",
          path: ["note"],
          message: "Note must be at most 1000 characters.",
        });
      }
      return;
    }

    if (trimmed.length > 1000) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Note must be at most 1000 characters.",
      });
    }
  })
  .transform((value) => {
    const trimmed = value.note?.trim() ?? "";
    const checkpoints = value.checkpoints;
    return {
      decision: value.decision,
      note: trimmed.length === 0 ? null : trimmed,
      checkpoints: {
        functionality: checkpoints?.functionality ?? CheckpointAssessment.NOT_ASSESSED,
        usability: checkpoints?.usability ?? CheckpointAssessment.NOT_ASSESSED,
        documentation: checkpoints?.documentation ?? CheckpointAssessment.NOT_ASSESSED,
      },
    };
  });

export type QueueQuery = z.infer<typeof queueQuerySchema>;
export type DecisionInput = z.infer<typeof decisionBodySchema>;
