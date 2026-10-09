import type { Store } from "@/types/store";

export function reconcileSelectedStore(
  selectedStore: Store | null,
  stores: readonly Store[],
): Store | null {
  if (!selectedStore) {
    return null;
  }

  return stores.find((store) => store.id === selectedStore.id) ?? null;
}
