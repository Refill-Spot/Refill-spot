import { randomUUID } from "node:crypto";
import withSerwist from "@serwist/next";
import { filterSafePrecacheEntries } from "./lib/pwa-cache.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    // API handlers can refresh session cookies even when reading public data.
    // This also protects handlers that return NextResponse directly.
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
  // ESLint와 TypeScript 오류를 빌드 시 체크하도록 설정
  eslint: {
    // 빌드 시 ESLint 실행
    ignoreDuringBuilds: false,
  },
  typescript: {
    // 빌드 시 TypeScript 오류 체크
    ignoreBuildErrors: false,
  },
  webpack: (config, { isServer }) => {
    // WASM hash 오류 해결을 위한 설정
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // 메모리 사용량 최적화
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          default: false,
          vendors: false,
        },
      },
    };

    return config;
  },
  images: {
    // Increase cache TTL to 31 days to reduce Vercel Image Transformations usage
    // Store images rarely change, so longer cache is beneficial
    minimumCacheTTL: 2678400, // 31 days in seconds (31 * 24 * 60 * 60)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placeholder.com",
      },
      {
        protocol: "https",
        hostname: "via.placeholder.com",
      },
      {
        protocol: "https",
        hostname: "dummyimage.com",
      },
      {
        protocol: "https",
        hostname: "example.com",
      },
      // AWS S3 domain for static assets
      ...(process.env.AWS_S3_HOSTNAME
        ? [
            {
              protocol: "https",
              hostname: process.env.AWS_S3_HOSTNAME,
            },
          ]
        : []),
      // Supabase storage domain
      ...(process.env.NEXT_PUBLIC_SUPABASE_URL
        ? [
            {
              protocol: "https",
              hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
            },
          ]
        : []),
    ],
  },
};

export default withSerwist({
  swSrc: "worker/index.js",
  swDest: "public/sw.js",
  swUrl: "/sw.js",
  scope: "/",
  register: true,
  cacheOnNavigation: false,
  reloadOnOnline: true,
  // Development uses Turbopack; Serwist's webpack integration is production-only.
  disable: process.env.NODE_ENV !== "production",
  globPublicPatterns: [],
  additionalPrecacheEntries: [{ url: "/offline", revision: randomUUID() }],
  manifestTransforms: [filterSafePrecacheEntries],
})(nextConfig);
