import hero from "@/assets/hero-laptop.jpg";

const LAPTOP_IMAGES = "/images/laptops";

/** Built-in photos are stored by key (e.g. "preset:gaming") so saved products survive rebuilds. */
export const PRESET_IMAGES = {
  ultrabook: `${LAPTOP_IMAGES}/laptop-ultrabook%201.jpg`,
  "ultrabook-alt": `${LAPTOP_IMAGES}/laptop-ultrabook%202.jpg`,
  gaming: `${LAPTOP_IMAGES}/laptop-gaming.jpg`,
  business: `${LAPTOP_IMAGES}/laptop-business.jpg`,
  creator: `${LAPTOP_IMAGES}/laptop-creator.jpg`,
  convertible: `${LAPTOP_IMAGES}/laptop-convertible.jpg`,
  everyday: `${LAPTOP_IMAGES}/laptop-everyday.jpg`,
  hero,
} as const;

export type PresetImageKey = keyof typeof PRESET_IMAGES;

export const PRESET_IMAGE_OPTIONS: { key: PresetImageKey; label: string }[] = [
  { key: "ultrabook", label: "Ultrabook" },
  { key: "gaming", label: "Gaming laptop" },
  { key: "business", label: "Business laptop" },
  { key: "creator", label: "Creator laptop" },
  { key: "convertible", label: "2-in-1 convertible" },
  { key: "everyday", label: "Everyday laptop" },
];

export function resolveImage(ref: string | undefined): string {
  if (!ref) return PRESET_IMAGES.everyday;
  if (ref.startsWith("preset:")) {
    const key = ref.slice(7) as PresetImageKey;
    return PRESET_IMAGES[key] ?? PRESET_IMAGES.everyday;
  }
  return ref;
}
