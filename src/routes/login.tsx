import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import type { AppRole } from "@/lib/types";
import { AuthLayout } from "@/components/common/auth-layout";
import { RolePicker } from "@/components/common/role-picker";
import { AdminSignInForm, CustomerSignInForm } from "@/components/auth/role-forms";

type Search = { redirect?: string | undefined; role?: AppRole | undefined };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s["redirect"] === "string" ? { redirect: s["redirect"] } : {}),
    ...(s["role"] === "admin" || s["role"] === "customer" ? { role: s["role"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Sign in — BuySense" },
      { name: "description", content: "Sign in to BuySense to check out, track orders and manage your wishlist." },
      { property: "og:title", content: "Sign in — BuySense" },
      { property: "og:description", content: "Sign in to your BuySense account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  const [role, setRole] = useState<AppRole>(search.role === "admin" ? "admin" : "customer");
  const searchForRegister = search.redirect ? { redirect: search.redirect, role } : { role };

  return (
    <AuthLayout
      title={role === "admin" ? "Admin sign in" : "Welcome back"}
      subtitle="Choose your account type, then sign in to continue."
      footer={
        <>
          New to BuySense?{" "}
          <Link to="/register" search={searchForRegister} className="font-semibold text-brand hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <RolePicker value={role} onChange={setRole} />
        {role === "admin" ? (
          <AdminSignInForm />
        ) : (
          <CustomerSignInForm />
        )}
      </div>
    </AuthLayout>
  );
}
