import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const accountInputSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(255)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Use at least 8 characters").max(72),
  role: z.enum(["customer", "admin"]),
});

/**
 * Create a new Auth account and assign its requested signup role on the server.
 * Existing accounts cannot be promoted through this endpoint: Auth rejects a
 * duplicate email, and only a newly-created trigger row is ever updated.
 */
export const registerAccount = createServerFn({ method: "POST" })
  .validator(accountInputSchema)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });

    if (createError || !created.user) {
      const code = createError && "code" in createError ? String(createError.code) : "UNKNOWN";
      const message = createError?.message ?? "Auth did not return a user.";
      if (
        code === "email_exists" ||
        code === "user_already_exists" ||
        /already been registered|already exists/i.test(message)
      ) {
        throw new Error("An account with this email already exists. Sign in instead.");
      }
      console.error("[Account registration] Supabase Auth rejected account creation", {
        code,
        message,
      });
      throw new Error(`Supabase Auth could not create this account (${code}): ${message}`);
    }

    if (data.role === "admin") {
      const { data: assignedRole, error: roleError } = await supabaseAdmin
        .from("user_roles")
        .update({ role: "admin" })
        .eq("user_id", created.user.id)
        .eq("role", "customer")
        .select("role")
        .maybeSingle();

      if (roleError || assignedRole?.role !== "admin") {
        console.error("[Account registration] Admin role assignment failed", {
          code: roleError?.code ?? "CUSTOMER_ROLE_NOT_FOUND",
          message: roleError?.message ?? "Signup trigger did not create the customer role row.",
          details: roleError?.details ?? null,
          hint: roleError?.hint ?? null,
        });
        await supabaseAdmin.auth.admin.deleteUser(created.user.id);
        throw new Error(
          `The account was not created because its admin role could not be assigned (${roleError?.code ?? "CUSTOMER_ROLE_NOT_FOUND"}).`,
        );
      }
    } else {
      const { data: roleRows, error: roleError } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", created.user.id);
      if (roleError || !roleRows?.some((row) => row.role === "customer")) {
        console.error("[Account registration] Customer role assignment failed", {
          code: roleError?.code ?? "CUSTOMER_ROLE_NOT_FOUND",
          message: roleError?.message ?? "Signup trigger did not create the customer role row.",
        });
        await supabaseAdmin.auth.admin.deleteUser(created.user.id);
        throw new Error(
          "Could not assign the customer role. Check the signup trigger and server logs.",
        );
      }
    }

    return { userId: created.user.id, role: data.role };
  });
