import type { Prisma } from "../generated/prisma/client.js";

/** Explicit allowlist: session responses must never inherit password fields. */
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} as const satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;
