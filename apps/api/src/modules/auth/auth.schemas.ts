import { z } from "zod";

import { assertPasswordPolicy } from "../../lib/password.js";
import { normalizeEmail } from "../../lib/email.js";

export const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required.")
      .max(100, "Name must be at most 100 characters."),
    email: z
      .string()
      .trim()
      .min(1, "Email is required.")
      .email("Enter a valid email address.")
      .transform(normalizeEmail),
    password: z.string().superRefine((value, ctx) => {
      const policyError = assertPasswordPolicy(value);
      if (policyError) {
        ctx.addIssue({ code: "custom", message: policyError });
      }
    }),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "Email is required.")
      .email("Enter a valid email address.")
      .transform(normalizeEmail),
    password: z.string().min(1, "Password is required."),
  })
  .strict();

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
