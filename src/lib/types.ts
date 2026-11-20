export const CATEGORIES = [
  "ultrabook",
  "gaming",
  "business",
  "creator",
  "convertible",
  "everyday",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  ultrabook: "Ultrabooks",
  gaming: "Gaming",
  business: "Business",
  creator: "Creator",
  convertible: "2-in-1",
  everyday: "Everyday",
};

export interface ProductSpecs {
  cpu: string;
  /** BuySense performance index, 1–100, derived from the processor tier. */
  cpuScore: number;
  gpu: string;
  /** BuySense graphics index, 1–100, derived from the graphics tier. */
  gpuScore: number;
  ramGb: number;
  storageGb: number;
  storageType: string;
  displaySize: number;
  displayResolution: string;
  displayType: string;
  refreshRate: number;
  batteryHours: number;
  weightKg: number;
  os: string;
  ports: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: Category;
  tagline: string;
  description: string;
  price: number;
  mrp: number;
  images: string[];
  stock: number;
  featured: boolean;
  specs: ProductSpecs;
  createdAt: string;
}

export type AppRole = "admin" | "customer";

export interface Address {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  address: Address | null;
  role: AppRole;
  createdAt: string;
}

export interface CartLine {
  productId: string;
  quantity: number;
}

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export interface OrderItem {
  productId: string;
  name: string;
  brand: string;
  image: string;
  unitPrice: number;
  quantity: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
  paymentMethod: "cod";
  status: OrderStatus;
  address: Address;
  createdAt: string;
  statusHistory: { status: OrderStatus; at: string }[];
}
