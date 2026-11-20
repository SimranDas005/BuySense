import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/types";

const VARIANT: Record<OrderStatus, "warning" | "brand" | "muted" | "success" | "destructive"> = {
  pending: "warning",
  confirmed: "brand",
  processing: "brand",
  shipped: "muted",
  delivered: "success",
  cancelled: "destructive",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={VARIANT[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}
