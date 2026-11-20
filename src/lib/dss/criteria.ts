import type { Product } from "../types";
import { formatINR } from "../format";

export type CriterionType = "benefit" | "cost";

export interface Criterion {
  key: string;
  label: string;
  type: CriterionType;
  description: string;
  value: (p: Product) => number;
  display: (p: Product) => string;
}

export function performanceIndex(p: Product): number {
  return Math.round(p.specs.cpuScore * 0.6 + p.specs.gpuScore * 0.4);
}

export function displayIndex(p: Product): number {
  const t = p.specs.displayType.toLowerCase();
  const panel = t.includes("oled") || t.includes("mini-led") || t.includes("xdr") ? 1 : 0.7;
  const [w = 1920, h = 1080] = p.specs.displayResolution
    .split(/[×x]/)
    .map((s) => Number.parseInt(s.trim(), 10));
  const pixels = Math.min((w * h) / (3840 * 2400), 1);
  const refresh = Math.min(p.specs.refreshRate / 165, 1);
  return Math.round(panel * 40 + pixels * 35 + refresh * 25);
}

export const CRITERIA: Criterion[] = [
  {
    key: "price",
    label: "Price",
    type: "cost",
    description: "Lower price is better",
    value: (p) => p.price,
    display: (p) => formatINR(p.price),
  },
  {
    key: "performance",
    label: "Performance",
    type: "benefit",
    description: "Processor and graphics power",
    value: performanceIndex,
    display: (p) => `${performanceIndex(p)}/100`,
  },
  {
    key: "memory",
    label: "Memory",
    type: "benefit",
    description: "RAM for multitasking",
    value: (p) => p.specs.ramGb,
    display: (p) => `${p.specs.ramGb} GB`,
  },
  {
    key: "storage",
    label: "Storage",
    type: "benefit",
    description: "SSD capacity",
    value: (p) => p.specs.storageGb,
    display: (p) => (p.specs.storageGb >= 1024 ? `${p.specs.storageGb / 1024} TB` : `${p.specs.storageGb} GB`),
  },
  {
    key: "display",
    label: "Display",
    type: "benefit",
    description: "Panel, sharpness and refresh rate",
    value: displayIndex,
    display: (p) => `${displayIndex(p)}/100`,
  },
  {
    key: "battery",
    label: "Battery",
    type: "benefit",
    description: "Rated battery life",
    value: (p) => p.specs.batteryHours,
    display: (p) => `${p.specs.batteryHours} h`,
  },
  {
    key: "portability",
    label: "Portability",
    type: "cost",
    description: "Lighter is better",
    value: (p) => p.specs.weightKg,
    display: (p) => `${p.specs.weightKg} kg`,
  },
];
