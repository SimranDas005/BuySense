import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, type Category, type Product, type ProductSpecs } from "../types";
import { SEED_PRODUCTS } from "../seed-products";
import { requireAdmin } from "./auth";
import { ApiError, toApiError } from "./errors";

export type ProductInput = Omit<Product, "id" | "createdAt">;

type ProductRow = {
  id: string;
  slug: string | null;
  name: string;
  brand: string;
  category_slug: string | null;
  tagline: string | null;
  description: string | null;
  price: number;
  mrp: number | null;
  images: unknown[] | null;
  specs: Record<string, unknown> | null;
  stock: number;
  featured: boolean;
  is_active: boolean;
  created_at: string | null;
};

const EMPTY_SPECS: ProductSpecs = {
  cpu: "Unknown", cpuScore: 0, gpu: "Unknown", gpuScore: 0,
  ramGb: 0, storageGb: 0, storageType: "SSD", displaySize: 0,
  displayResolution: "Unknown", displayType: "Unknown", refreshRate: 0,
  batteryHours: 0, weightKg: 0, os: "Unknown", ports: "Unknown",
};

function toCategory(value: string | null): Category {
  return CATEGORIES.find((c) => c === value) ?? "everyday";
}

function toProduct(row: ProductRow): Product {
  const category = toCategory(row.category_slug);
  const categoryPreset = category === "convertible" ? "convertible" : category;
  return {
    id: row.id,
    slug: row.slug ?? "",
    name: row.name,
    brand: row.brand,
    category,
    tagline: row.tagline ?? "",
    description: row.description ?? "",
    price: row.price,
    mrp: row.mrp ?? row.price,
    // The supplied category artwork is the consistent storefront image for
    // every listing, detail page and comparison entry in that category.
    images: [`preset:${categoryPreset}`],
    stock: row.stock,
    featured: row.featured,
    specs: { ...EMPTY_SPECS, ...(row.specs as Partial<ProductSpecs> | null) },
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

function isCompleteProductRow(value: unknown): value is ProductRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<ProductRow>;
  const specs = row.specs;
  if (
    typeof row.id !== "string" ||
    typeof row.slug !== "string" ||
    !row.slug.trim() ||
    typeof row.name !== "string" ||
    !row.name.trim() ||
    typeof row.brand !== "string" ||
    !row.brand.trim() ||
    !CATEGORIES.includes(row.category_slug as Category) ||
    typeof row.price !== "number" ||
    !Number.isFinite(row.price) ||
    typeof row.stock !== "number" ||
    !Number.isFinite(row.stock) ||
    !specs ||
    typeof specs !== "object"
  ) {
    return false;
  }

  const s = specs as Partial<ProductSpecs>;
  return (
    typeof s.cpu === "string" && s.cpu.trim().length > 0 &&
    typeof s.cpuScore === "number" && Number.isFinite(s.cpuScore) &&
    typeof s.gpu === "string" && s.gpu.trim().length > 0 &&
    typeof s.gpuScore === "number" && Number.isFinite(s.gpuScore) &&
    typeof s.ramGb === "number" && s.ramGb > 0 &&
    typeof s.storageGb === "number" && s.storageGb > 0 &&
    typeof s.storageType === "string" && s.storageType.trim().length > 0 &&
    typeof s.displaySize === "number" && s.displaySize > 0 &&
    typeof s.displayResolution === "string" && s.displayResolution.trim().length > 0 &&
    typeof s.displayType === "string" && s.displayType.trim().length > 0 &&
    typeof s.refreshRate === "number" && s.refreshRate > 0 &&
    typeof s.batteryHours === "number" && s.batteryHours > 0 &&
    typeof s.weightKg === "number" && s.weightKg > 0 &&
    typeof s.os === "string" && s.os.trim().length > 0 &&
    typeof s.ports === "string" && s.ports.trim().length > 0
  );
}

function seedCatalog(): Product[] {
  return SEED_PRODUCTS.map((product, index) => ({
    ...product,
    id: `seed-${product.slug}`,
    createdAt: new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString(),
  }));
}

function applyLegacyDatabasePrices(products: Product[], rows: unknown[]): Product[] {
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  for (const value of rows) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    if (
      row["is_active"] !== true ||
      typeof row["id"] !== "string" ||
      typeof row["slug"] !== "string" ||
      !row["slug"].trim() ||
      typeof row["model"] !== "string" ||
      !row["model"].trim() ||
      typeof row["brand"] !== "string" ||
      !row["brand"].trim() ||
      typeof row["price"] !== "number" ||
      !Number.isFinite(row["price"]) ||
      row["price"] <= 0 ||
      typeof row["stock"] !== "number" ||
      !Number.isInteger(row["stock"]) ||
      row["stock"] < 0
    ) {
      continue;
    }

    const existing = bySlug.get(row["slug"]);
    if (!existing) continue;
    bySlug.set(row["slug"], {
      ...existing,
      id: row["id"],
      name: row["model"],
      brand: row["brand"],
      price: row["price"],
      mrp:
        typeof row["original_price"] === "number" &&
        Number.isFinite(row["original_price"]) &&
        row["original_price"] >= row["price"]
          ? row["original_price"]
          : row["price"],
      images:
        typeof row["image_url"] === "string" && row["image_url"]
          ? [row["image_url"]]
          : existing.images,
      stock: row["stock"],
    });
  }
  return [...bySlug.values()];
}

/** Seed products guarantee the storefront remains complete when Supabase is unavailable. */
export function mergeCatalogProducts(seeds: Product[], remote: Product[]): Product[] {
  const bySlug = new Map(seeds.map((product) => [product.slug, product]));
  const knownModels = new Set(
    seeds.map((product) => `${product.brand.trim().toLowerCase()}|${product.name.trim().toLowerCase()}`),
  );
  for (const product of remote) {
    if (!product.slug) continue;
    const modelKey = `${product.brand.trim().toLowerCase()}|${product.name.trim().toLowerCase()}`;
    if (knownModels.has(modelKey) && !bySlug.has(product.slug)) continue;
    bySlug.set(product.slug, product);
    knownModels.add(modelKey);
  }
  return [...bySlug.values()];
}

function toRowValues(input: ProductInput, slug: string) {
  const specs = input.specs as unknown as Record<string, unknown>;
  return {
    slug,
    name: input.name,
    brand: input.brand,
    category_slug: input.category,
    tagline: input.tagline,
    description: input.description,
    price: input.price,
    mrp: input.mrp,
    images: input.images,
    specs,
    stock: input.stock,
    featured: input.featured,
    is_active: true,
    // Legacy columns kept populated for any existing reporting queries.
    model: input.name,
    original_price: input.mrp,
    image_url: input.images[0] ?? "",
    processor: input.specs.cpu,
    ram: `${input.specs.ramGb} GB`,
    storage: `${input.specs.storageGb} GB ${input.specs.storageType}`,
    graphics: input.specs.gpu,
    display: `${input.specs.displaySize}" ${input.specs.displayResolution}`,
    battery: `${input.specs.batteryHours} hours`,
  };
}

export async function listProducts(): Promise<Product[]> {
  const seeds = seedCatalog();
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) return seeds;
    const completeRows = (data ?? []).filter(isCompleteProductRow);
    const merged = mergeCatalogProducts(seeds, completeRows.map(toProduct));
    return applyLegacyDatabasePrices(merged, data ?? []);
  } catch {
    return seeds;
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return (await listProducts()).find((product) => product.slug === slug) ?? null;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueSlug(base: string, list: Product[], ignoreId?: string): string {
  let slug = slugify(base) || "laptop";
  let n = 2;
  const taken = (s: string) => list.some((p) => p.slug === s && p.id !== ignoreId);
  while (taken(slug)) slug = `${slugify(base)}-${n++}`;
  return slug;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  await requireAdmin();
  const list = await listProducts();
  const slug = uniqueSlug(input.slug || input.name, list);
  const { data, error } = await supabase.from("products").insert(toRowValues(input, slug)).select().single();
  if (error) throw toApiError(error, "Could not add this laptop.");
  return toProduct(data as ProductRow);
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  await requireAdmin();
  const list = await listProducts();
  const existing = list.find((p) => p.id === id);
  if (!existing) throw new ApiError("Product not found.");
  const slug = uniqueSlug(input.slug || input.name, list, id);
  const { data, error } = await supabase
    .from("products")
    .update(toRowValues(input, slug))
    .eq("id", id)
    .select()
    .single();
  if (error) throw toApiError(error, "Could not update this laptop.");
  return toProduct(data as ProductRow);
}

export async function deleteProduct(id: string): Promise<void> {
  await requireAdmin();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw toApiError(error, "Could not delete this laptop.");
}

export async function setStock(id: string, stock: number): Promise<void> {
  await requireAdmin();
  if (!Number.isInteger(stock) || stock < 0) throw new ApiError("Stock must be a whole number ≥ 0.");
  const { error } = await supabase.rpc("set_product_stock", { p_product_id: id, p_stock: stock });
  if (error) throw toApiError(error, "Could not update stock.");
}
