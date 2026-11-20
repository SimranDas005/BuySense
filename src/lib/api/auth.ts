import { supabase } from "@/integrations/supabase/client";
import type { AppRole, Address, UserProfile } from "../types";
import { ApiError, toApiError } from "./errors";
import { registerAccount } from "./admin-account.functions";
import {
  adminAuthEmailErrorMessage,
  authEmailErrorMessage,
  emailSchema,
} from "../email-validation";

function rowToProfile(
  row: {
    id: string;
    email: string | null;
    full_name: string | null;
    phone: string | null;
    created_at: string | null;
  },
  role: AppRole,
  address: Address | null = null,
): UserProfile {
  return {
    id: row.id,
    email: row.email ?? "",
    fullName: row.full_name ?? "",
    phone: row.phone ?? "",
    address,
    role,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

async function getUserRole(userId: string): Promise<AppRole> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);

  if (error) throw toApiError(error, "Could not verify your account role.");
  if (data?.some((row) => row.role === "admin")) return "admin";
  if (data?.some((row) => row.role === "customer")) return "customer";
  throw new ApiError("This account has no assigned role. Please contact support.");
}

/** The live schema stores delivery addresses on orders, not profiles. */
async function getLatestOrderAddress(
  userId: string,
  fullName: string,
  phone: string,
): Promise<Address | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("customer_name, phone, address_line1, address_line2, city, state, pincode")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw toApiError(error, "Could not load your latest delivery address.");
  if (!data) return null;
  return {
    fullName: data.customer_name ?? fullName,
    phone: data.phone ?? phone,
    line1: data.address_line1 ?? "",
    line2: data.address_line2 ?? "",
    city: data.city ?? "",
    state: data.state ?? "",
    pincode: data.pincode ?? "",
  };
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw toApiError(error, "Could not load your profile.");
  if (!data) return null;
  const [role, address] = await Promise.all([
    getUserRole(userId),
    getLatestOrderAddress(userId, data.full_name ?? "", data.phone ?? ""),
  ]);
  const profile = rowToProfile(data, role, address);
  return profile;
}

/** Current signed-in user, including their authoritative role from the DB. */
export async function getCurrentUser(): Promise<UserProfile | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw toApiError(error, "Could not read your session.");
  const session = data.session;
  if (!session) {
    return null;
  }
  // Always resolve role from user_roles for each guard/API boundary so role
  // changes take effect immediately instead of relying on stale client cache.
  return fetchProfile(session.user.id);
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function requireUser(): Promise<UserProfile> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError("Please sign in to continue.");
  return user;
}

export async function requireAdmin(): Promise<UserProfile> {
  const user = await requireUser();
  if (user.role !== "admin") throw new ApiError("Only administrators can do this.");
  return user;
}

export async function requireCustomer(): Promise<UserProfile> {
  const user = await requireUser();
  if (user.role !== "customer")
    throw new ApiError("This feature is available to customer accounts only.");
  return user;
}

export interface SignUpResult {
  user: UserProfile | null;
  needsConfirmation: boolean;
}

export async function register(input: {
  fullName: string;
  email: string;
  password: string;
  role: AppRole;
}): Promise<SignUpResult> {
  const email = emailSchema.parse(input.email);
  let created: Awaited<ReturnType<typeof registerAccount>>;
  try {
    created = await registerAccount({
      data: {
        fullName: input.fullName.trim(),
        email,
        password: input.password,
        role: input.role,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create your account.";
    throw new ApiError(
      adminAuthEmailErrorMessage(error) ?? authEmailErrorMessage(error) ?? message,
    );
  }

  // Supabase Auth handles password hashing; the server confirms the demo
  // account so an email delivery/verification step cannot block sign-in.
  const { data: signedIn, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (signInError) {
    throw new ApiError(
      `Account created, but automatic sign-in failed: ${signInError.message}. Please sign in.`,
    );
  }

  if (signedIn.user.id !== created.userId || created.role !== input.role) {
    await supabase.auth.signOut();
    throw new ApiError("The account role could not be verified. Please sign in again.");
  }
  const user = await fetchProfile(signedIn.user.id);
  if (!user || user.role !== input.role) {
    await supabase.auth.signOut();
    throw new ApiError("The account role could not be verified. Please contact support.");
  }
  return { user, needsConfirmation: false };
}

export async function login(input: {
  email: string;
  password: string;
  role: AppRole;
}): Promise<UserProfile> {
  const email = emailSchema.parse(input.email);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (error) {
    const invalidEmail = authEmailErrorMessage(error);
    throw new ApiError(invalidEmail ?? "Incorrect email or password.");
  }

  let user: UserProfile | null;
  try {
    user = await fetchProfile(data.user.id);
  } catch (e) {
    await supabase.auth.signOut();
    throw e;
  }
  if (!user) {
    await supabase.auth.signOut();
    throw new ApiError("This account has no profile. Please contact support.");
  }
  if (input.role === "admin" && user.role !== "admin") {
    await supabase.auth.signOut();
    throw new ApiError("This account is not an administrator account.");
  }
  if (input.role === "customer" && user.role !== "customer") {
    await supabase.auth.signOut();
    throw new ApiError("This account is an administrator account. Choose Admin to sign in.");
  }
  return user;
}

export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw toApiError(error, "Could not sign out.");
}

export async function updateProfile(patch: {
  fullName?: string;
  phone?: string;
}): Promise<UserProfile> {
  const me = await requireUser();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      ...(patch.fullName !== undefined ? { full_name: patch.fullName.trim() } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone.trim() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", me.id)
    .select("id, email, full_name, phone, created_at")
    .single();
  if (error) throw toApiError(error, "Could not save your profile.");
  const [role, address] = await Promise.all([
    getUserRole(me.id),
    getLatestOrderAddress(me.id, data.full_name ?? "", data.phone ?? ""),
  ]);
  const user = rowToProfile(data, role, address);
  return user;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const me = await requireCustomer();
  // Re-authenticate first so an unattended session can't be used to change the password.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: me.email,
    password: currentPassword,
  });
  if (verifyError) throw new ApiError("Your current password is incorrect.");
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw toApiError(error, "Could not change your password.");
}

/** Sends a real Supabase Auth recovery email. Always resolves to avoid account enumeration. */
export async function requestPasswordReset(email: string): Promise<{ sent: boolean }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw toApiError(error, "Could not send the reset email.");
  return { sent: true };
}

/** Exchanges the PKCE code / token hash in a recovery link for a session. */
export async function confirmRecoveryFromUrl(search: URLSearchParams): Promise<boolean> {
  const code = search.get("code");
  const tokenHash = search.get("token_hash");
  const type = search.get("type") ?? "recovery";

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw toApiError(error, "This reset link is invalid or has expired.");
    return true;
  }
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type === "recovery" ? "recovery" : "email",
    });
    if (error) throw toApiError(error, "This reset link is invalid or has expired.");
    return true;
  }
  return false;
}

export async function resetPassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw toApiError(error, "Could not update your password.");
}

export async function listCustomers(): Promise<UserProfile[]> {
  await requireAdmin();
  const { data: roleRows, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id, role");
  if (rolesError) throw toApiError(rolesError, "Could not load customer roles.");

  const adminIds = new Set(
    (roleRows ?? []).filter((row) => row.role === "admin").map((row) => row.user_id),
  );
  const customerIds = [
    ...new Set(
      (roleRows ?? [])
        .filter((row) => row.role === "customer" && !adminIds.has(row.user_id))
        .map((row) => row.user_id),
    ),
  ];
  if (!customerIds.length) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, created_at")
    .in("id", customerIds);
  if (error) throw toApiError(error, "Could not load customers.");
  return (data ?? []).map((row) => rowToProfile(row, "customer"));
}
