import { useSyncExternalStore } from "react";

export const MAX_COMPARE = 5;
const KEY = "buysense:v1:compare";
const EMPTY: string[] = [];
const listeners = new Set<() => void>();
let cache: string[] | null = null;

export type CompareResult = { ok: true; ids: string[] } | { ok: false; ids: string[]; reason: string };

/** Pure rule: a comparison holds at most MAX_COMPARE laptops, without duplicates. */
export function addToCompareList(ids: string[], id: string): CompareResult {
  if (ids.includes(id)) return { ok: true, ids };
  if (ids.length >= MAX_COMPARE) {
    return { ok: false, ids, reason: `You can compare up to ${MAX_COMPARE} laptops at a time.` };
  }
  return { ok: true, ids: [...ids, id] };
}

function read(): string[] {
  if (typeof window === "undefined") return EMPTY;
  if (cache) return cache;
  try {
    cache = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    cache = [];
  }
  return cache;
}

function write(ids: string[]) {
  cache = ids;
  window.localStorage.setItem(KEY, JSON.stringify(ids));
  listeners.forEach((l) => l());
}

export const compareStore = {
  get: read,
  add(id: string): CompareResult {
    const res = addToCompareList(read(), id);
    if (res.ok) write(res.ids);
    return res;
  },
  remove(id: string) {
    write(read().filter((x) => x !== id));
  },
  clear() {
    write([]);
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useCompareIds(): string[] {
  return useSyncExternalStore(compareStore.subscribe, read, () => EMPTY);
}
