/** @type {import("serwist").RouteMatchCallback} */
export const isNetworkOnlyRequest = ({ url, request }) =>
  url.pathname === "/api" ||
  url.pathname.startsWith("/api/") ||
  request.mode === "navigate" ||
  request.headers.get("RSC") === "1" ||
  request.destination === "image" ||
  url.pathname === "/_next/image";

/** @param {import("serwist").PrecacheEntry | string} entry */
export function isSafePrecacheEntry(entry) {
  const path = typeof entry === "string" ? entry : entry.url;
  const url = new URL(path, "https://precache.invalid");
  if (url.origin !== "https://precache.invalid" || url.pathname !== path) {
    return false;
  }
  return (
    path === "/offline" ||
    /^\/_next\/static\/.+\.(?:js|css|woff2?|ttf|otf|wasm)$/.test(path)
  );
}

/** @type {NonNullable<import("@serwist/next").PluginOptions["manifestTransforms"]>[number]} */
export const filterSafePrecacheEntries = (entries) => ({
  manifest: entries.filter(isSafePrecacheEntry),
  warnings: [],
});

export const obsoleteRuntimeCacheNames = [
  "api-stores",
  "api-store-details",
  "api-store-reviews",
  "api-favorites",
  "api-my-reviews",
  "api-announcements",
  "images",
  "start-url",
  // Verified in next-pwa's default routes and frontend navigation worker.
  "pages",
  "pages-rsc",
  "pages-rsc-prefetch",
  "next-data",
];

/** @param {CacheStorage} cacheStorage */
export async function deleteObsoleteRuntimeCaches(cacheStorage) {
  const names = await cacheStorage.keys();
  await Promise.all(
    names
      .filter((name) => obsoleteRuntimeCacheNames.includes(name))
      .map((name) => cacheStorage.delete(name)),
  );
}
