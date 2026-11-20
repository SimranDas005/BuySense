import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import * as catalog from "@/lib/api/catalog";
import * as commerce from "@/lib/api/commerce";
import * as admin from "@/lib/api/admin";
import { summarizeCart } from "@/lib/cart-math";
import type { Address, OrderStatus } from "@/lib/types";
import { useAuth } from "./use-auth";

export const qk = {
  products: ["products"] as const,
  product: (slug: string) => ["products", "slug", slug] as const,
  cart: (owner: string) => ["cart", owner] as const,
  wishlist: (owner: string) => ["wishlist", owner] as const,
  myOrders: (owner: string) => ["orders", "mine", owner] as const,
  order: (id: string) => ["orders", "one", id] as const,
  allOrders: ["orders", "all"] as const,
  stats: ["admin", "stats"] as const,
  customers: ["admin", "customers"] as const,
};

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

export function useProducts() {
  return useQuery({ queryKey: qk.products, queryFn: catalog.listProducts });
}

export function useProduct(slug: string) {
  return useQuery({ queryKey: qk.product(slug), queryFn: () => catalog.getProductBySlug(slug) });
}

function useOwner() {
  const { user, loading } = useAuth();
  return { owner: user?.id ?? "guest", user, loading };
}

export function useCart() {
  const { owner, user, loading } = useOwner();
  const products = useProducts();
  const cart = useQuery({
    queryKey: qk.cart(owner),
    queryFn: commerce.getCart,
    enabled: !loading && (!user || user.role === "customer"),
  });
  const summary = useMemo(
    () => summarizeCart(cart.data ?? [], products.data ?? []),
    [cart.data, products.data],
  );
  return { summary, isLoading: loading || cart.isLoading || products.isLoading };
}

function useInvalidateShop() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["cart"] }),
      qc.invalidateQueries({ queryKey: qk.products }),
      qc.invalidateQueries({ queryKey: ["orders"] }),
      qc.invalidateQueries({ queryKey: ["admin"] }),
      qc.invalidateQueries({ queryKey: ["wishlist"] }),
    ]);
}

export function useAddToCart() {
  const invalidate = useInvalidateShop();
  return useMutation({
    mutationFn: ({ productId, quantity = 1 }: { productId: string; quantity?: number; name?: string }) =>
      commerce.addToCart(productId, quantity),
    onSuccess: (_d, v) => {
      void invalidate();
      toast.success(v.name ? `${v.name} added to your bag` : "Added to your bag");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useSetCartQuantity() {
  const invalidate = useInvalidateShop();
  return useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) =>
      commerce.setCartQuantity(productId, quantity),
    onSuccess: () => void invalidate(),
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useWishlist() {
  const { owner, user, loading } = useOwner();
  return useQuery({
    queryKey: qk.wishlist(owner),
    queryFn: commerce.getWishlist,
    enabled: !loading && user?.role === "customer",
  });
}

export function useToggleWishlist() {
  const invalidate = useInvalidateShop();
  return useMutation({
    mutationFn: (productId: string) => commerce.toggleWishlist(productId),
    onSuccess: (added) => {
      void invalidate();
      toast.success(added ? "Saved to your wishlist" : "Removed from your wishlist");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function usePlaceOrder() {
  const invalidate = useInvalidateShop();
  return useMutation({
    mutationFn: (address: Address) => commerce.placeOrder(address),
    onSuccess: () => void invalidate(),
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useMyOrders() {
  const { owner, user, loading } = useOwner();
  return useQuery({
    queryKey: qk.myOrders(owner),
    queryFn: commerce.listMyOrders,
    enabled: !loading && user?.role === "customer",
  });
}

export function useOrder(id: string) {
  const { user, loading } = useOwner();
  return useQuery({
    queryKey: qk.order(id),
    queryFn: () => commerce.getOrder(id),
    enabled: !loading && user?.role === "customer",
  });
}

export function useCancelOrder() {
  const invalidate = useInvalidateShop();
  return useMutation({
    mutationFn: (id: string) => commerce.cancelMyOrder(id),
    onSuccess: () => {
      void invalidate();
      toast.success("Your order has been cancelled");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

/* ---------------- Admin ---------------- */

export function useAllOrders() {
  return useQuery({ queryKey: qk.allOrders, queryFn: admin.listAllOrders });
}

export function useDashboardStats() {
  return useQuery({ queryKey: qk.stats, queryFn: admin.getDashboardStats });
}

export function useCustomers() {
  return useQuery({ queryKey: qk.customers, queryFn: admin.listCustomers });
}

export function useUpdateOrderStatus() {
  const invalidate = useInvalidateShop();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => admin.updateOrderStatus(id, status),
    onSuccess: (o) => {
      void invalidate();
      toast.success(`Order ${o.orderNumber} is now ${o.status}`);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useSaveProduct() {
  const invalidate = useInvalidateShop();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: catalog.ProductInput }) =>
      id ? catalog.updateProduct(id, input) : catalog.createProduct(input),
    onSuccess: (p, v) => {
      void invalidate();
      toast.success(v.id ? `${p.name} updated` : `${p.name} added to the catalogue`);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateShop();
  return useMutation({
    mutationFn: (id: string) => catalog.deleteProduct(id),
    onSuccess: () => {
      void invalidate();
      toast.success("Product deleted");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useSetStock() {
  const invalidate = useInvalidateShop();
  return useMutation({
    mutationFn: ({ id, stock }: { id: string; stock: number }) => catalog.setStock(id, stock),
    onSuccess: () => void invalidate(),
    onError: (e) => toast.error(errMsg(e)),
  });
}
