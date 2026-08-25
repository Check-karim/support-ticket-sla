import { Prisma, type PrismaClient, type UserRole } from "@prisma/client";
import { AppError, ErrorCode } from "../../errors.js";
import { requireNonEmpty } from "../../validation/input.js";
import { publicUserSelect } from "../ticket/ticket-service.js";
import { hashPassword, verifyPassword } from "./password.js";
import { signAccessToken } from "./token.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export type AuthPayload = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    createdAt: Date;
  };
};

function normalizeEmail(email: string): string {
  return requireNonEmpty(email, "email").toLowerCase();
}

function validateEmail(email: string): string {
  const normalized = normalizeEmail(email);
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "email is invalid.");
  }
  return normalized;
}

function validatePassword(password: string): string {
  if (password.trim() === "") {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "password must not be empty.");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      `password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }
  return password;
}

export async function register(
  prisma: PrismaClient,
  input: { name: string; email: string; password: string; role: UserRole },
): Promise<AuthPayload> {
  if (input.role !== "REPORTER") {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Agent accounts cannot be self-registered.",
    );
  }

  const name = requireNonEmpty(input.name, "name");
  const email = validateEmail(input.email);
  const password = validatePassword(input.password);
  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "REPORTER",
      },
      select: publicUserSelect,
    });

    return {
      token: await signAccessToken(user.id, user.role),
      user,
    };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "An account with this email already exists.",
      );
    }
    throw error;
  }
}

export async function login(
  prisma: PrismaClient,
  input: { email: string; password: string },
): Promise<AuthPayload> {
  const email = validateEmail(input.email);
  const password = validatePassword(input.password);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  const passwordMatches =
    user !== null && (await verifyPassword(password, user.passwordHash));

  if (user === null || !passwordMatches) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid email or password.");
  }

  return {
    token: await signAccessToken(user.id, user.role),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
  };
}
