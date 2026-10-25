import { z } from "zod";

import {
  assertPasswordPolicy,
  PASSWORD_MAX_BYTES,
  passwordByteLength,
} from "../../lib/password.js";
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
    // Reject over-long passwords before bcrypt so a 73+ byte string cannot
    // authenticate as the matching 72-byte prefix of a stored password.
    password: z
      .string()
      .min(1, "Password is required.")
      .superRefine((value, ctx) => {
        if (passwordByteLength(value) > PASSWORD_MAX_BYTES) {
          ctx.addIssue({
            code: "custom",
            message: `Password must be at most ${PASSWORD_MAX_BYTES} bytes (bcrypt limit).`,
          });
        }
      }),
  })
  .strict();

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
