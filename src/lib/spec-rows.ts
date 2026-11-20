import { discountPercent, formatINR, formatStorage } from "./format";
import { CATEGORY_LABELS, type Product } from "./types";

export function specRows(p: Product): [string, string][] {
  const s = p.specs;
  return [
    ["Brand", p.brand],
    ["Model", p.name],
    ["Category", CATEGORY_LABELS[p.category]],
    ["Processor", s.cpu],
    ["Graphics", s.gpu],
    ["Memory", `${s.ramGb} GB`],
    ["Storage", `${formatStorage(s.storageGb)} ${s.storageType}`],
    ["Display", `${s.displaySize}″ ${s.displayType}`],
    ["Resolution", s.displayResolution],
    ["Refresh rate", `${s.refreshRate} Hz`],
    ["Battery life", `Up to ${s.batteryHours} hours`],
    ["Weight", `${s.weightKg} kg`],
    ["Operating system", s.os],
    ["Ports", s.ports],
    ["Current price", formatINR(p.price)],
    ["Original price", formatINR(p.mrp)],
    ["Discount", `${discountPercent(p.price, p.mrp)}%`],
    ["Stock status", p.stock > 0 ? `In stock (${p.stock} available)` : "Out of stock"],
  ];
}
