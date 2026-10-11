import { NetworkOnly, Serwist } from "serwist";
import {
  deleteObsoleteRuntimeCaches,
  isNetworkOnlyRequest,
  isSafePrecacheEntry,
} from "../lib/pwa-cache.mjs";

const networkOnly = new NetworkOnly({
  fetchOptions: { cache: "no-store" },
  plugins: [
    {
      // Serwist ignores fetchOptions for navigation; set the Request cache too.
      requestWillFetch: ({ request }) =>
        new Request(request, { cache: "no-store" }),
    },
  ],
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST.filter(isSafePrecacheEntry),
  precacheOptions: { cleanURLs: false, ignoreURLParametersMatching: [] },
  skipWaiting: true,
  clientsClaim: false,
  navigationPreload: false,
  disableDevLogs: true,
  runtimeCaching: [{ matcher: isNetworkOnlyRequest, handler: networkOnly }],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => {
          const url = new URL(request.url);
          return (
            request.mode === "navigate" &&
            request.headers.get("RSC") !== "1" &&
            url.origin === self.location.origin &&
            url.pathname !== "/api" &&
            !url.pathname.startsWith("/api/")
          );
        },
      },
    ],
  },
});

// Serwist installs its precache route first. Private requests must take priority,
// even for /offline or a URL that happens to be a precached build asset.
const [precacheRoute] = serwist.routes.get("GET");
serwist.unregisterRoute(precacheRoute);
serwist.registerRoute(precacheRoute);
for (const method of [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
]) {
  serwist.setDefaultHandler(networkOnly, method);
}

self.addEventListener("activate", (event) => {
  // Claim existing clients only after their old private runtime caches are gone.
  event.waitUntil(
    deleteObsoleteRuntimeCaches(self.caches).then(() => self.clients.claim()),
  );
});

serwist.addEventListeners();
