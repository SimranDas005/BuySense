import { createFileRoute, Link } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { Heart, Loader2, Package } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormField } from "@/components/common/form-field";
import { PageHeader } from "@/components/common/page-header";
import { useAuth } from "@/hooks/use-auth";
import { useMyOrders, useWishlist } from "@/hooks/use-shop";
import { changePassword, updateProfile } from "@/lib/api/auth";
import { formatDate } from "@/lib/format";

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  phone: z.string().trim().refine((v) => v === "" || /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit mobile number"),
});
const passwordSchema = z
  .object({ current: z.string().min(1, "Enter your current password"), next: z.string().min(8, "Use at least 8 characters").max(72), confirm: z.string() })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export const Route = createFileRoute("/_account/account")({
  head: () => ({
    meta: [
      { title: "My profile — BuySense" },
      { name: "description", content: "Manage your BuySense profile, saved address and password." },
      { property: "og:title", content: "My profile — BuySense" },
      { property: "og:description", content: "Manage your BuySense account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user } = useAuth();
  const { data: orders = [] } = useMyOrders();
  const { data: wishlist = [] } = useWishlist();
  const profile = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: { fullName: "", phone: "" } });
  const pw = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) });

  const resetProfile = profile.reset;
  useEffect(() => {
    if (user) resetProfile({ fullName: user.fullName, phone: user.phone });
  }, [user, resetProfile]);

  if (!user) return null;

  const saveProfile = profile.handleSubmit(async (v) => {
    await updateProfile(v);
    toast.success("Profile saved");
  });
  const savePassword = pw.handleSubmit(async (v) => {
    try {
      await changePassword(v.current, v.next);
      pw.reset({ current: "", next: "", confirm: "" });
      toast.success("Password updated");
    } catch (e) {
      pw.setError("current", { message: e instanceof Error ? e.message : "Could not update password" });
    }
  });

  return (
    <div className="container-page max-w-5xl py-10">
      <PageHeader eyebrow="Account" title={`Hi, ${user.fullName.split(" ")[0] || "there"}`} description={`Member since ${formatDate(user.createdAt)} · ${user.email}`} />

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link to="/orders" className="flex items-center gap-4 rounded-3xl border bg-card p-5 shadow-soft transition-all hover:shadow-lift">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand"><Package className="h-5 w-5" /></div>
          <div><p className="text-2xl font-semibold">{orders.length}</p><p className="text-sm text-muted-foreground">Orders</p></div>
        </Link>
        <Link to="/wishlist" className="flex items-center gap-4 rounded-3xl border bg-card p-5 shadow-soft transition-all hover:shadow-lift">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive"><Heart className="h-5 w-5" /></div>
          <div><p className="text-2xl font-semibold">{wishlist.length}</p><p className="text-sm text-muted-foreground">Saved laptops</p></div>
        </Link>
      </div>

      <Tabs defaultValue="profile" className="mt-10">
        <TabsList className="h-11 rounded-full p-1">
          <TabsTrigger value="profile" className="rounded-full px-5">Profile</TabsTrigger>
          <TabsTrigger value="address" className="rounded-full px-5">Address</TabsTrigger>
          <TabsTrigger value="security" className="rounded-full px-5">Password</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-6">
          <form onSubmit={saveProfile} noValidate className="max-w-xl space-y-4 rounded-3xl border bg-card p-6 shadow-soft">
            <FormField label="Full name" error={profile.formState.errors.fullName?.message} {...profile.register("fullName")} />
            <FormField label="Email" value={user.email} disabled readOnly />
            <FormField label="Mobile number" inputMode="numeric" maxLength={10} error={profile.formState.errors.phone?.message} {...profile.register("phone")} />
            <Button type="submit" variant="ink" disabled={profile.formState.isSubmitting}>{profile.formState.isSubmitting && <Loader2 className="animate-spin" />} Save changes</Button>
          </form>
        </TabsContent>
        <TabsContent value="address" className="mt-6">
          <div className="max-w-xl rounded-3xl border bg-card p-6 shadow-soft">
            {user.address ? (
              <>
                <p className="font-semibold">{user.address.fullName}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {user.address.line1}{user.address.line2 ? `, ${user.address.line2}` : ""}<br />
                  {user.address.city}, {user.address.state} {user.address.pincode}<br />
                  {user.address.phone}
                </p>
                <p className="mt-4 text-xs text-muted-foreground">Your address updates whenever you save it at checkout.</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No saved address yet. Add one at checkout and tick "Save this address".</p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="security" className="mt-6">
          <form onSubmit={savePassword} noValidate className="max-w-xl space-y-4 rounded-3xl border bg-card p-6 shadow-soft">
            <FormField label="Current password" type="password" autoComplete="current-password" error={pw.formState.errors.current?.message} {...pw.register("current")} />
            <FormField label="New password" type="password" autoComplete="new-password" error={pw.formState.errors.next?.message} {...pw.register("next")} />
            <FormField label="Confirm new password" type="password" autoComplete="new-password" error={pw.formState.errors.confirm?.message} {...pw.register("confirm")} />
            <Button type="submit" variant="ink" disabled={pw.formState.isSubmitting}>{pw.formState.isSubmitting && <Loader2 className="animate-spin" />} Update password</Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
