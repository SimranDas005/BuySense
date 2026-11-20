import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { OrderDetailCard, OrderNotFound } from "@/components/orders/order-detail";
import { useCancelOrder, useOrder } from "@/hooks/use-shop";

export const Route = createFileRoute("/_account/orders/$orderId")({
  head: () => ({
    meta: [
      { title: "Order details — BuySense" },
      { name: "description", content: "Status, items and delivery details for your BuySense order." },
      { property: "og:title", content: "Order details — BuySense" },
      { property: "og:description", content: "Your BuySense order details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderPage,
});

function OrderPage() {
  const { orderId } = Route.useParams();
  const { data: order, isLoading } = useOrder(orderId);
  const cancel = useCancelOrder();
  const cancellable = order && (order.status === "pending" || order.status === "confirmed");

  return (
    <div className="container-page max-w-4xl py-10">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild><Link to="/orders"><ArrowLeft /> All orders</Link></Button>
        {cancellable && (
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" size="sm">Cancel order</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
                <AlertDialogDescription>Order {order.orderNumber} will be cancelled. This can't be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep order</AlertDialogCancel>
                <AlertDialogAction onClick={() => cancel.mutate(order.id)}>Cancel order</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      {isLoading ? <Skeleton className="h-96 rounded-3xl" /> : order ? <OrderDetailCard order={order} /> : <OrderNotFound />}
    </div>
  );
}
