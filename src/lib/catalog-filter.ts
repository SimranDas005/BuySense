import type { Category, Product } from "./types";
import { performanceIndex } from "./dss/criteria";

export const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "performance", label: "Best performance" },
  { value: "battery", label: "Longest battery" },
  { value: "lightest", label: "Lightest" },
  { value: "newest", label: "Newest" },
] as const;
export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export interface CatalogFilters {
  q?: string | undefined;
  category?: Category | undefined;
  brand?: string | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  ram?: number | undefined;
  inStock?: boolean | undefined;
  sort?: SortValue | undefined;
}

export function filterProducts(products: Product[], f: CatalogFilters): Product[] {
  const q = f.q?.trim().toLowerCase();
  const list = products.filter((p) => {
    if (q) {
      const hay = `${p.name} ${p.brand} ${p.category} ${p.specs.cpu} ${p.specs.gpu} ${p.tagline}`.toLowerCase();
      if (!q.split(/\s+/).every((t) => hay.includes(t))) return false;
    }
    if (f.category && p.category !== f.category) return false;
    if (f.brand && p.brand !== f.brand) return false;
    if (f.minPrice != null && p.price < f.minPrice) return false;
    if (f.maxPrice != null && p.price > f.maxPrice) return false;
    if (f.ram != null && p.specs.ramGb < f.ram) return false;
    if (f.inStock && p.stock <= 0) return false;
    return true;
  });
  const sorted = [...list];
  switch (f.sort ?? "featured") {
    case "price-asc":
      sorted.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      sorted.sort((a, b) => b.price - a.price);
      break;
    case "performance":
      sorted.sort((a, b) => performanceIndex(b) - performanceIndex(a));
      break;
    case "battery":
      sorted.sort((a, b) => b.specs.batteryHours - a.specs.batteryHours);
      break;
    case "lightest":
      sorted.sort((a, b) => a.specs.weightKg - b.specs.weightKg);
      break;
    case "newest":
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    default:
      sorted.sort((a, b) => Number(b.featured) - Number(a.featured));
  }
  return sorted;
}
