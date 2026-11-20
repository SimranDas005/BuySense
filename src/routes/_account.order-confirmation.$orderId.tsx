import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderDetailCard, OrderNotFound } from "@/components/orders/order-detail";
import { useOrder } from "@/hooks/use-shop";

export const Route = createFileRoute("/_account/order-confirmation/$orderId")({
  head: () => ({
    meta: [
      { title: "Order confirmed — BuySense" },
      { name: "description", content: "Thank you for your order. Pay with cash when your laptop arrives." },
      { property: "og:title", content: "Order confirmed — BuySense" },
      { property: "og:description", content: "Your BuySense order is confirmed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Confirmation,
});

function Confirmation() {
  const { orderId } = Route.useParams();
  const { data: order, isLoading } = useOrder(orderId);
  return (
    <div className="container-page max-w-4xl py-12">
      {isLoading ? (
        <Skeleton className="h-96 rounded-3xl" />
      ) : !order ? (
        <OrderNotFound />
      ) : (
        <>
          <div className="mb-10 text-center animate-fade-up">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success-soft text-success shadow-soft">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="mt-5 text-3xl font-semibold md:text-4xl">Thank you, {order.customerName.split(" ")[0]}!</h1>
            <p className="mt-2 text-muted-foreground">Your order <span className="font-semibold text-foreground">{order.orderNumber}</span> has been placed. We'll keep you updated as it moves.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="ink" asChild><Link to="/orders">View my orders</Link></Button>
              <Button variant="outline" asChild><Link to="/laptops">Continue shopping</Link></Button>
            </div>
          </div>
          <OrderDetailCard order={order} />
        </>
      )}
    </div>
  );
}
