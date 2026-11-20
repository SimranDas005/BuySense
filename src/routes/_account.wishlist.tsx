import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ProductGrid } from "@/components/product/product-card";
import { useProducts, useWishlist } from "@/hooks/use-shop";

export const Route = createFileRoute("/_account/wishlist")({
  head: () => ({
    meta: [
      { title: "My wishlist — BuySense" },
      { name: "description", content: "Laptops you've saved on BuySense." },
      { property: "og:title", content: "My wishlist — BuySense" },
      { property: "og:description", content: "Your saved laptops." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Wishlist,
});

function Wishlist() {
  const { data: ids = [], isLoading } = useWishlist();
  const { data: products = [], isLoading: pl } = useProducts();
  const items = ids.map((id) => products.find((p) => p.id === id)).filter((p) => p != null);
  return (
    <div className="container-page py-10">
      <PageHeader eyebrow="Account" title="Wishlist" description={items.length ? `${items.length} saved laptop${items.length > 1 ? "s" : ""}` : undefined} />
      <div className="mt-8">
        {!isLoading && !pl && items.length === 0 ? (
          <EmptyState icon={Heart} title="Nothing saved yet" description="Tap the heart on any laptop to keep it here." action={<Button asChild><Link to="/laptops">Browse laptops</Link></Button>} />
        ) : (
          <ProductGrid products={items} loading={isLoading || pl} skeletons={4} />
        )}
      </div>
    </div>
  );
}
