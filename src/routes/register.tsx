import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import type { AppRole } from "@/lib/types";
import { AuthLayout } from "@/components/common/auth-layout";
import { RolePicker } from "@/components/common/role-picker";
import { AdminRegisterForm, CustomerRegisterForm } from "@/components/auth/role-forms";

type Search = { redirect?: string | undefined; role?: AppRole | undefined };

export const Route = createFileRoute("/register")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s["redirect"] === "string" ? { redirect: s["redirect"] } : {}),
    ...(s["role"] === "admin" || s["role"] === "customer" ? { role: s["role"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Create account — BuySense" },
      { name: "description", content: "Create a BuySense account to buy laptops with Cash on Delivery and save your favourites." },
      { property: "og:title", content: "Create account — BuySense" },
      { property: "og:description", content: "Join BuySense." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const search = Route.useSearch();
  const [role, setRole] = useState<AppRole>(search.role === "admin" ? "admin" : "customer");
  const searchForLogin = search.redirect ? { redirect: search.redirect, role } : { role };

  return (
    <AuthLayout
      title={role === "admin" ? "Create an admin account" : "Create your account"}
      subtitle="Pick the account type that fits you."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" search={searchForLogin} className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <RolePicker value={role} onChange={setRole} label="I want to register as" />
        {role === "admin" ? (
          <AdminRegisterForm />
        ) : (
          <CustomerRegisterForm redirect={search.redirect} />
        )}
      </div>
    </AuthLayout>
  );
}
