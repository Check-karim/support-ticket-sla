import { AppError, ErrorCode } from "../errors.js";

export function requireNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new AppError(ErrorCode.VALIDATION_ERROR, `${field} must not be empty.`);
  }
  return trimmed;
}
