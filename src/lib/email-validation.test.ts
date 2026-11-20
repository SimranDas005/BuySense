import { describe, expect, it } from "vitest";
import { adminAuthEmailErrorMessage, emailSchema } from "./email-validation";

describe("email validation", () => {
  it("accepts a short, valid Gmail address and normalizes it", () => {
    expect(emailSchema.parse(" dh@gmail.com ")).toBe("dh@gmail.com");
  });

  it("reports Supabase email restrictions separately from local format validation", () => {
    const authError = Object.assign(new Error("Email address 'dh@gmail.com' is invalid"), {
      code: "email_address_invalid",
    });

    expect(adminAuthEmailErrorMessage(authError)).toContain("BuySense accepts its email format");
    expect(adminAuthEmailErrorMessage(authError)).toContain("email_address_invalid");
  });

  it("surfaces other Supabase errors without changing their meaning", () => {
    const authError = Object.assign(new Error("Email rate limit exceeded"), {
      code: "over_email_send_rate_limit",
    });

    expect(adminAuthEmailErrorMessage(authError)).toBeNull();
  });
});
