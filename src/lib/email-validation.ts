import { z } from "zod";

/** Use the same standard email check and normalization across auth forms/APIs. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(255, "Email address must be 255 characters or fewer");

export function authEmailErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  if (/email(?: address)? is invalid|invalid email/i.test(error.message)) {
    const code = "code" in error && typeof error.code === "string" ? error.code : "unknown";
    return `Supabase Auth rejected this address (${code}): ${error.message}`;
  }
  return null;
}

/** Preserve the Supabase cause on Admin signup without labeling syntax errors as local errors. */
export function adminAuthEmailErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null;

  const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
  if (code === "email_address_not_authorized") {
    return "Supabase Auth is not configured to accept this email address. Check the project's allowed email domains or Auth hook settings.";
  }

  if (
    code === "email_address_invalid" ||
    /email(?: address)?\s+['"].+['"]\s+is invalid|email(?: address)? is invalid|invalid email/i.test(
      error.message,
    )
  ) {
    const codeNote = code ? ` (${code})` : "";
    return `Supabase Auth${codeNote} rejected this address: ${error.message}. BuySense accepts its email format; check the project's Auth email restrictions or validation hook.`;
  }

  return null;
}
