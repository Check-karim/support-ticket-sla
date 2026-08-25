import { SignJWT, jwtVerify } from "jose";
import { env } from "../../config/env.js";
import { AppError, ErrorCode } from "../../errors.js";

const encoder = new TextEncoder();
const JWT_EXPIRATION = "7d";

function secretKey(): Uint8Array {
  return encoder.encode(env.jwtSecret);
}

export async function signAccessToken(userId: string, role: string): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION)
    .sign(secretKey());
}

export async function verifyAccessToken(token: string): Promise<{ userId: string }> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string" || payload.sub === "") {
      throw new Error("Missing subject");
    }
    return { userId: payload.sub };
  } catch {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired token.");
  }
}
