import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { safeRedirect } from "@/components/common/auth-layout";
import { FormField } from "@/components/common/form-field";
import { useAuth } from "@/hooks/use-auth";
import { emailSchema } from "@/lib/email-validation";

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

const registerFields = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  email: emailSchema,
  password: z.string().min(8, "Use at least 8 characters").max(72),
  confirm: z.string(),
});
const passwordsMatch = (v: { password: string; confirm: string }) => v.password === v.confirm;
const mismatch = { path: ["confirm"], message: "Passwords don't match" };

const registerSchema = registerFields.refine(passwordsMatch, mismatch);
const adminRegisterSchema = registerSchema;

type SignInValues = z.infer<typeof signInSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
    >
      {message}
    </p>
  );
}

function ForgotLink() {
  return (
    <Link
      to="/forgot-password"
      className="mt-2 inline-block text-xs font-semibold text-brand hover:underline"
    >
      Forgot password?
    </Link>
  );
}

function ConfirmationPanel({ email, admin = false }: { email: string; admin?: boolean }) {
  return (
    <div className="rounded-3xl border bg-card p-6 text-center shadow-soft">
      <MailCheck className="mx-auto h-8 w-8 text-success" />
      <p className="mt-3 font-semibold">Check your email</p>
      <p className="mt-1 text-sm text-muted-foreground">
        We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>.
        {admin
          ? " Verify the address, then choose Admin on sign-in. Administrator access is limited to approved email addresses."
          : " Open it to activate your account, then sign in."}
      </p>
    </div>
  );
}

/* ----------------------------- Sign in ----------------------------- */

function useSignInForm(role: "customer" | "admin") {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });

  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      const user = await signIn(v.email, v.password, role);
      // Keep each verified role in its own experience, regardless of redirect parameters.
      const to = user.role === "admin" ? "/admin" : "/";
      toast.success(`Welcome back, ${user.fullName.split(" ")[0] || "there"}!`);
      void navigate({ to, replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
    }
  });

  return { form, error, onSubmit };
}

export function CustomerSignInForm() {
  const { form, error, onSubmit } = useSignInForm("customer");
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormField
        label="Email"
        type="email"
        autoComplete="email"
        error={form.formState.errors.email?.message}
        {...form.register("email")}
      />
      <div>
        <FormField
          label="Password"
          type="password"
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          {...form.register("password")}
        />
        <ForgotLink />
      </div>
      <ErrorMessage message={error} />
      <Button
        type="submit"
        size="lg"
        variant="ink"
        className="w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting && <Loader2 className="animate-spin" />} Sign in as customer
      </Button>
    </form>
  );
}

export function AdminSignInForm() {
  const { form, error, onSubmit } = useSignInForm("admin");
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <p className="rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
        Use your administrator credentials. Administrative sessions are separate from customer
        accounts.
      </p>
      <FormField
        label="Admin email"
        type="email"
        autoComplete="email"
        error={form.formState.errors.email?.message}
        {...form.register("email")}
      />
      <div>
        <FormField
          label="Password"
          type="password"
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          {...form.register("password")}
        />
        <ForgotLink />
      </div>
      <ErrorMessage message={error} />
      <Button
        type="submit"
        size="lg"
        variant="ink"
        className="w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting && <Loader2 className="animate-spin" />} Sign in to admin
      </Button>
    </form>
  );
}

/* -------------------------- Create account -------------------------- */

export function CustomerRegisterForm({ redirect }: { redirect?: string | undefined }) {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const form = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      const result = await signUp({
        fullName: v.fullName,
        email: v.email,
        password: v.password,
        role: "customer",
      });
      if (result.needsConfirmation) {
        setEmail(v.email);
        return;
      }
      if (result.user) toast.success(`Welcome to BuySense, ${result.user.fullName.split(" ")[0]}!`);
      void navigate({ to: redirect ? safeRedirect(redirect) : "/", replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create your account.");
    }
  });

  if (email) return <ConfirmationPanel email={email} />;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormField
        label="Full name"
        autoComplete="name"
        error={form.formState.errors.fullName?.message}
        {...form.register("fullName")}
      />
      <FormField
        label="Email"
        type="email"
        autoComplete="email"
        error={form.formState.errors.email?.message}
        {...form.register("email")}
      />
      <FormField
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters"
        error={form.formState.errors.password?.message}
        {...form.register("password")}
      />
      <FormField
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        error={form.formState.errors.confirm?.message}
        {...form.register("confirm")}
      />
      <ErrorMessage message={error} />
      <Button
        type="submit"
        size="lg"
        variant="ink"
        className="w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting && <Loader2 className="animate-spin" />} Create customer
        account
      </Button>
    </form>
  );
}

export function AdminRegisterForm() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const form = useForm<z.infer<typeof adminRegisterSchema>>({ resolver: zodResolver(adminRegisterSchema) });

  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      const result = await signUp({
        fullName: v.fullName,
        email: v.email,
        password: v.password,
        role: "admin",
      });
      if (result.needsConfirmation) {
        setPendingEmail(v.email);
        return;
      }
      if (result.user) toast.success(`Admin account created for ${result.user.fullName}.`);
      void navigate({ to: "/admin", replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create your admin account.");
    }
  });

  if (pendingEmail) return <ConfirmationPanel email={pendingEmail} admin />;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormField
        label="Full name"
        autoComplete="name"
        error={form.formState.errors.fullName?.message}
        {...form.register("fullName")}
      />
      <FormField
        label="Admin email"
        type="email"
        autoComplete="email"
        error={form.formState.errors.email?.message}
        {...form.register("email")}
      />
      <FormField
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters"
        error={form.formState.errors.password?.message}
        {...form.register("password")}
      />
      <FormField
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        error={form.formState.errors.confirm?.message}
        {...form.register("confirm")}
      />
      <ErrorMessage message={error} />
      <Button
        type="submit"
        size="lg"
        variant="ink"
        className="w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting && <Loader2 className="animate-spin" />} Create admin account
      </Button>
    </form>
  );
}
