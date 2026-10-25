import bcrypt from "bcryptjs";

/** bcrypt only uses the first 72 UTF-8 bytes; longer passwords are rejected, not truncated. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;
export const BCRYPT_COST = 12;

export function passwordByteLength(password: string): number {
  return Buffer.byteLength(password, "utf8");
}

export function assertPasswordPolicy(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (passwordByteLength(password) > PASSWORD_MAX_BYTES) {
    return `Password must be at most ${PASSWORD_MAX_BYTES} bytes (bcrypt limit).`;
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const policyError = assertPasswordPolicy(password);
  if (policyError) {
    throw new Error(policyError);
  }
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Compare a candidate password to a stored hash without bcrypt truncation.
 * Inputs longer than 72 UTF-8 bytes are treated as non-matching so a longer
 * string cannot silently authenticate as its 72-byte prefix.
 */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (passwordByteLength(password) > PASSWORD_MAX_BYTES) {
    return false;
  }
  return bcrypt.compare(password, passwordHash);
}
