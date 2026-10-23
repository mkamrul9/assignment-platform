import type { Role } from "../generated/prisma/client.js";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
