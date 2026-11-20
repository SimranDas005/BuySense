import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { Banknote, CheckCircle2, Loader2, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { OrderSummaryRows } from "@/components/common/order-summary";
import { PageHeader } from "@/components/common/page-header";
import { useAuth } from "@/hooks/use-auth";
import { useCart, usePlaceOrder } from "@/hooks/use-shop";
import { updateProfile } from "@/lib/api/auth";
import { addressSchema, INDIAN_STATES, type AddressForm } from "@/lib/address";
import { formatINR } from "@/lib/format";
import { resolveImage } from "@/lib/images";

export const Route = createFileRoute("/_account/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — BuySense" },
      { name: "description", content: "Enter your delivery address and place your order with Cash on Delivery." },
      { property: "og:title", content: "Checkout — BuySense" },
      { property: "og:description", content: "Secure Cash on Delivery checkout." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const { user } = useAuth();
  const { summary, isLoading } = useCart();
  const place = usePlaceOrder();
  const navigate = useNavigate();
  const [saveAddress, setSaveAddress] = useState(true);
  const { register, handleSubmit, control, reset, formState } = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: { fullName: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "" },
  });

  useEffect(() => {
    if (!user) return;
    reset(user.address ?? { fullName: user.fullName, phone: user.phone, line1: "", line2: "", city: "", state: "", pincode: "" });
  }, [user, reset]);

  const onSubmit = handleSubmit(async (address) => {
    let order;
    try {
      order = await place.mutateAsync(address);
    } catch {
      return; // the error is already shown as a notification
    }
    // The live schema stores delivery addresses on orders, not profiles. The
    // selected address is already stored with this order; only sync the phone
    // field to the supported profile columns.
    if (saveAddress) {
      try {
        await updateProfile({ phone: address.phone });
      } catch (error) {
        toast.error(
          error instanceof Error
            ? `Order placed, but your profile could not be updated: ${error.message}`
            : "Order placed, but your profile could not be updated.",
        );
      }
    }
    void navigate({ to: "/order-confirmation/$orderId", params: { orderId: order.id }, replace: true });
  });

  if (isLoading) return <div className="container-page py-10"><Skeleton className="h-96 rounded-3xl" /></div>;
  if (!summary.lines.length && !place.isPending && !place.isSuccess) {
    return (
      <div className="container-page py-10">
        <EmptyState icon={ShoppingBag} title="Your bag is empty" description="Add a laptop before checking out." action={<Button asChild><Link to="/laptops">Shop laptops</Link></Button>} />
      </div>
    );
  }

  const err = formState.errors;
  return (
    <div className="container-page py-10">
      <PageHeader eyebrow="Checkout" title="Delivery & payment" />
      <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <section className="rounded-3xl border bg-card p-6 shadow-soft">
            <h2 className="mb-5 text-lg font-semibold">Delivery address</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Full name" autoComplete="name" error={err.fullName?.message} {...register("fullName")} />
              <FormField label="Mobile number" inputMode="numeric" autoComplete="tel-national" maxLength={10} error={err.phone?.message} {...register("phone")} />
              <FormField className="sm:col-span-2" label="House no., building, street" autoComplete="address-line1" error={err.line1?.message} {...register("line1")} />
              <FormField className="sm:col-span-2" label="Area, landmark (optional)" autoComplete="address-line2" error={err.line2?.message} {...register("line2")} />
              <FormField label="City" autoComplete="address-level2" error={err.city?.message} {...register("city")} />
              <FormField label="PIN code" inputMode="numeric" maxLength={6} autoComplete="postal-code" error={err.pincode?.message} {...register("pincode")} />
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="state">State</Label>
                <Controller
                  control={control}
                  name="state"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="state" className="h-11 rounded-xl bg-card" aria-invalid={!!err.state}><SelectValue placeholder="Choose state" /></SelectTrigger>
                      <SelectContent>{INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                />
                {err.state && <p className="text-xs font-medium text-destructive">{err.state.message}</p>}
              </div>
            </div>
            <label className="mt-5 flex items-center gap-2 text-sm">
              <Checkbox checked={saveAddress} onCheckedChange={(v) => setSaveAddress(v === true)} /> Save this address to my profile
            </label>
          </section>

          <section className="rounded-3xl border bg-card p-6 shadow-soft">
            <h2 className="mb-5 text-lg font-semibold">Payment method</h2>
            <div className="flex items-center gap-4 rounded-2xl border-2 border-brand bg-brand-soft p-4">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-card"><Banknote className="h-5 w-5 text-brand" /></div>
              <div className="flex-1">
                <p className="font-semibold">Cash on Delivery</p>
                <p className="text-sm text-muted-foreground">Pay {formatINR(summary.total)} in cash or UPI to the courier when your laptop arrives.</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-brand" />
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-3xl border bg-card p-6 shadow-soft lg:sticky lg:top-24">
          <h2 className="mb-5 text-lg font-semibold">Your order</h2>
          <ul className="mb-5 space-y-3">
            {summary.lines.map((l) => (
              <li key={l.product.id} className="flex items-center gap-3">
                <img src={resolveImage(l.product.images[0])} alt="" className="h-12 w-16 rounded-lg bg-surface object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.product.name}</p>
                  <p className="text-xs text-muted-foreground">Qty {l.quantity}</p>
                </div>
                <p className="text-sm tabular-nums">{formatINR(l.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <OrderSummaryRows subtotal={summary.subtotal} savings={summary.savings} shipping={summary.shippingFee} total={summary.total} />
          <Button
            type="submit"
            size="lg"
            variant="brand"
            className="mt-6 w-full"
            disabled={formState.isSubmitting || summary.hasIssues}
          >
            {formState.isSubmitting && <Loader2 className="animate-spin" />} Place order · {formatINR(summary.total)}
          </Button>
          {summary.hasIssues && <p className="mt-2 text-xs text-destructive">Some items exceed available stock. <Link to="/cart" className="underline">Update your bag</Link>.</p>}
        </aside>
      </form>
    </div>
  );
}
