import { Prisma, Role } from "../../generated/prisma/client.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { prisma } from "../../lib/prisma.js";
import { publicUserSelect, type PublicUser } from "../../lib/public-user.js";
import type { LoginInput, SignupInput } from "./auth.schemas.js";

export class AuthConflictError extends Error {
  constructor(message = "An account with this email already exists.") {
    super(message);
    this.name = "AuthConflictError";
  }
}

export class AuthCredentialsError extends Error {
  constructor(message = "Invalid email or password.") {
    super(message);
    this.name = "AuthCredentialsError";
  }
}

export async function signupStudent(input: SignupInput): Promise<PublicUser> {
  const passwordHash = await hashPassword(input.password);

  try {
    return await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: Role.STUDENT,
      },
      select: publicUserSelect,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AuthConflictError();
    }
    throw error;
  }
}

export async function authenticateUser(input: LoginInput): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      ...publicUserSelect,
      passwordHash: true,
    },
  });

  if (!user) {
    throw new AuthCredentialsError();
  }

  const matches = await verifyPassword(input.password, user.passwordHash);
  if (!matches) {
    throw new AuthCredentialsError();
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}
