import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as auth from "@/lib/api/auth";
import type { SignUpResult } from "@/lib/api/auth";
import { mergeGuestCart } from "@/lib/api/commerce";
import type { AppRole, UserProfile } from "@/lib/types";

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  authLinkError: string | null;
  signIn: (email: string, password: string, role: AppRole) => Promise<UserProfile>;
  signUp: (input: {
    fullName: string;
    email: string;
    password: string;
    role: AppRole;
  }) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ sent: boolean }>;
  resetPassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLinkError, setAuthLinkError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        // A single place consumes recovery / email-confirmation links. Doing
        // this here (and disabling detectSessionInUrl) prevents the code from
        // being exchanged twice.
        const params = new URLSearchParams(window.location.search);
        if (params.has("code") || params.has("token_hash")) {
          await auth.confirmRecoveryFromUrl(params);
          const url = new URL(window.location.href);
          ["code", "token_hash", "type"].forEach((k) => url.searchParams.delete(k));
          window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
        }
        if (active) setUser(await auth.getCurrentUser());
      } catch (e) {
        if (active) setAuthLinkError(e instanceof Error ? e.message : "Could not verify this link.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void bootstrap();

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setLoading(false);
        return;
      }
      setTimeout(() => {
        void auth.getCurrentUser().then(
          (profile) => {
            setUser(profile);
            setLoading(false);
          },
          () => setLoading(false),
        );
      }, 0);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string, role: AppRole) => {
      const u = await auth.login({ email, password, role });
      if (u.role === "customer") await mergeGuestCart(u.id);
      await queryClient.invalidateQueries();
      return u;
    },
    [queryClient],
  );

  const signUp = useCallback(
    async (input: {
      fullName: string;
      email: string;
      password: string;
      role: AppRole;
    }) => {
      const result = await auth.register(input);
      if (result.user?.role === "customer") await mergeGuestCart(result.user.id);
      await queryClient.invalidateQueries();
      return result;
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await auth.logout();
    setUser(null);
  }, [queryClient]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdmin: user?.role === "admin",
      authLinkError,
      signIn,
      signUp,
      signOut,
      requestPasswordReset: auth.requestPasswordReset,
      resetPassword: auth.resetPassword,
    }),
    [user, loading, authLinkError, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
