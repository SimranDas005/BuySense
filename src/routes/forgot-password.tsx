import { createFileRoute, Link } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/common/auth-layout";
import { FormField } from "@/components/common/form-field";
import { requestPasswordReset } from "@/lib/api/auth";
import { emailSchema } from "@/lib/email-validation";

const schema = z.object({ email: emailSchema });

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — BuySense" },
      { name: "description", content: "Forgot your BuySense password? Request a reset link." },
      { property: "og:title", content: "Reset your password — BuySense" },
      { property: "og:description", content: "Request a BuySense password reset link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await requestPasswordReset(v.email);
      setSent(v.email);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the reset email.");
    }
  });

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your account email and we'll send you a secure reset link."
      footer={<Link to="/login" className="font-semibold text-brand hover:underline">Back to sign in</Link>}
    >
      {sent ? (
        <div className="rounded-3xl border bg-card p-6 text-center shadow-soft">
          <MailCheck className="mx-auto h-8 w-8 text-success" />
          <p className="mt-3 font-semibold">Check your inbox</p>
          <p className="mt-1 text-sm text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{sent}</span>, a reset link is on its way.
            The link expires shortly, so use it soon.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField label="Email" type="email" autoComplete="email" error={formState.errors.email?.message} {...register("email")} />
          {error && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{error}</p>}
          <Button type="submit" size="lg" variant="ink" className="w-full" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />} Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
