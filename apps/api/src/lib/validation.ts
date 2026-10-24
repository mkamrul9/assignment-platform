import type { ZodError } from "zod";

/** Stable field-error contract shared by API routes and browser forms. */
export function validationDetails(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "body",
    message: issue.message,
  }));
}
