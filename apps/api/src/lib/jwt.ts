import { SignJWT, jwtVerify, errors as JoseErrors } from "jose";

import { env } from "../config/env.js";

const ALGORITHM = "HS256";
export const SESSION_TTL_SECONDS = 30 * 60;

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<{ userId: string }> {
  const { payload } = await jwtVerify(token, secretKey(), {
    algorithms: [ALGORITHM],
    requiredClaims: ["exp", "sub", "iss", "aud"],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new JoseErrors.JWTInvalid("Token subject is missing.");
  }

  return { userId: payload.sub };
}

export { JoseErrors };
