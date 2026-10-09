import type { Store } from "@/types/store";

export function getRepresentativeMenu(store: Pick<Store, "refillItems">) {
  const items = store.refillItems ?? [];
  const priced = items.filter((item) => item.price?.trim());
  return priced.find((item) => item.is_recommended) ?? priced[0] ?? items[0];
}

export function formatStoreDistance(distance: string | null | undefined) {
  const value = distance?.trim();
  if (!value) {
    return null;
  }
  return /^\d+(?:\.\d+)?$/.test(value) ? `${value}km` : value;
}
