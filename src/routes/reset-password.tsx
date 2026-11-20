import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/common/auth-layout";
import { FormField } from "@/components/common/form-field";
import { useAuth } from "@/hooks/use-auth";

const schema = z
  .object({ password: z.string().min(8, "Use at least 8 characters").max(72), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

type Search = {
  code?: string | undefined;
  token_hash?: string | undefined;
  type?: string | undefined;
};

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s["code"] === "string" ? { code: s["code"] } : {}),
    ...(typeof s["token_hash"] === "string" ? { token_hash: s["token_hash"] } : {}),
    ...(typeof s["type"] === "string" ? { type: s["type"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Choose a new password — BuySense" },
      { name: "description", content: "Set a new password for your BuySense account." },
      { property: "og:title", content: "Choose a new password — BuySense" },
      { property: "og:description", content: "Set a new BuySense password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading, authLinkError, resetPassword, signOut } = useAuth();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const hadLink = Boolean(search.code || search.token_hash);

  useEffect(() => {
    if (loading) return;
    if (!hadLink || authLinkError || !user) {
      setStatus("invalid");
      if (authLinkError) setError(authLinkError);
      return;
    }
    setStatus("ready");
  }, [loading, hadLink, authLinkError, user]);

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await resetPassword(v.password);
      await signOut();
      toast.success("Password updated. Please sign in.");
      void navigate({ to: "/login", replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset password.");
    }
  });

  return (
    <AuthLayout title="Choose a new password" footer={<Link to="/forgot-password" className="font-semibold text-brand hover:underline">Request a new link</Link>}>
      {status === "checking" ? (
        <p className="text-sm text-muted-foreground">Verifying your reset link…</p>
      ) : status === "invalid" ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error ?? "This reset link is missing or invalid. Please request a new one."}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField label="New password" type="password" autoComplete="new-password" error={formState.errors.password?.message} {...register("password")} />
          <FormField label="Confirm new password" type="password" autoComplete="new-password" error={formState.errors.confirm?.message} {...register("confirm")} />
          {error && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{error}</p>}
          <Button type="submit" size="lg" variant="ink" className="w-full" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />} Update password
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
