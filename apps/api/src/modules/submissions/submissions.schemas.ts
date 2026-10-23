import { z } from "zod";

import { assertHttpsUrlWithoutCredentials } from "../../lib/https-url.js";

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

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
