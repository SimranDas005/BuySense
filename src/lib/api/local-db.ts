/**
 * Browser storage is used ONLY for the anonymous ("guest") shopping bag and
 * local UI state. Accounts, sessions, profiles, orders and the catalogue all
 * live in Supabase and are protected by RLS.
 */
const PREFIX = "buysense:v1:";
type Listener = (table: string) => void;
const listeners = new Set<Listener>();

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readTable<T>(name: string, fallback: T): T {
  if (!hasStorage()) return fallback;
  const raw = window.localStorage.getItem(PREFIX + name);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeTable<T>(name: string, value: T): void {
  if (!hasStorage()) throw new ApiError("Storage is not available in this browser.");
  window.localStorage.setItem(PREFIX + name, JSON.stringify(value));
  listeners.forEach((l) => l(name));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function resetLocalDb(): void {
  if (!hasStorage()) return;
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => window.localStorage.removeItem(k));
}
