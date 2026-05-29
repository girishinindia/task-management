/**
 * JWT helpers — HS256 access + refresh tokens via `jose`.
 *
 * Every token carries a unique `jti` so we can revoke it via Redis on logout
 * or token rotation. `kind: "access" | "refresh"` keeps the two pools apart.
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { randomUUID } from "crypto";
import { env } from "@/lib/env";

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

const ISSUER = "task-portal";
const AUDIENCE = "task-portal-app";

export type UserRole = "admin" | "user";

export interface AccessClaims extends JWTPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
  kind: "access";
  jti: string;
}

export interface RefreshClaims extends JWTPayload {
  sub: string;
  family: string; // refresh-token family for rotation detection
  kind: "refresh";
  jti: string;
}

export async function signAccessToken(input: {
  userId: string;
  email: string;
  role: UserRole;
}): Promise<{ token: string; jti: string }> {
  const jti = randomUUID();
  const token = await new SignJWT({
    email: input.email,
    role: input.role,
    kind: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setJti(jti)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_EXPIRES_IN)
    .sign(accessSecret);
  return { token, jti };
}

export async function signRefreshToken(input: {
  userId: string;
  family?: string;
}): Promise<{ token: string; jti: string; family: string }> {
  const jti = randomUUID();
  const family = input.family ?? randomUUID();
  const token = await new SignJWT({
    family,
    kind: "refresh",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setJti(jti)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(env.JWT_REFRESH_EXPIRES_IN)
    .sign(refreshSecret);
  return { token, jti, family };
}

export async function verifyAccess(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, accessSecret, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (payload.kind !== "access") throw new Error("Not an access token");
  return payload as AccessClaims;
}

export async function verifyRefresh(token: string): Promise<RefreshClaims> {
  const { payload } = await jwtVerify(token, refreshSecret, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (payload.kind !== "refresh") throw new Error("Not a refresh token");
  return payload as RefreshClaims;
}
