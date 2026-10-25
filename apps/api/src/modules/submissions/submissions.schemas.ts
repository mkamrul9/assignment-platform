import { z } from "zod";

import { assertHttpsUrlWithoutCredentials } from "../../lib/https-url.js";

const MINE_STATUSES = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const;

/** Maximum length for student project search `q` after trim. */
export const MINE_SEARCH_MAX_LENGTH = 100;

function httpsUrlField(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(2048, `${label} must be at most 2048 characters.`)
    .superRefine((value, ctx) => {
      const error = assertHttpsUrlWithoutCredentials(value, label);
      if (error) {
        ctx.addIssue({ code: "custom", message: error });
      }
    });
}

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

export const createSubmissionSchema = z
  .object({
    projectName: z
      .string()
      .trim()
      .min(3, "Project name must be at least 3 characters.")
      .max(100, "Project name must be at most 100 characters."),
    repositoryUrl: httpsUrlField("Repository URL"),
    liveUrl: httpsUrlField("Live URL"),
    description: z
      .string()
      .trim()
      .min(20, "Description must be at least 20 characters.")
      .max(5000, "Description must be at most 5000 characters."),
  })
  .strict();

export const mineQuerySchema = z
  .object({
    page: positiveInt("page").default(1),
    pageSize: positiveInt("pageSize", 50).default(10),
    status: z.enum(MINE_STATUSES).default("ALL"),
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
      .refine((value) => value === undefined || value.length <= MINE_SEARCH_MAX_LENGTH, {
        message: `q must be at most ${MINE_SEARCH_MAX_LENGTH} characters.`,
      }),
  })
  .strict();

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type MineQuery = z.infer<typeof mineQuerySchema>;
