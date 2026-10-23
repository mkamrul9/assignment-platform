import { z } from "zod";

import { ReviewDecision } from "../../generated/prisma/client.js";

const QUEUE_STATUSES = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const;

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
  })
  .strict();

export const decisionBodySchema = z
  .object({
    decision: z.enum([ReviewDecision.APPROVED, ReviewDecision.REJECTED]),
    note: z.string().optional(),
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
    return {
      decision: value.decision,
      note: trimmed.length === 0 ? null : trimmed,
    };
  });

export type QueueQuery = z.infer<typeof queueQuerySchema>;
export type DecisionInput = z.infer<typeof decisionBodySchema>;
