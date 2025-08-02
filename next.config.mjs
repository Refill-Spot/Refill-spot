import withPWA from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
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

export default withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: false,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // 가게 목록 API - 자주 변하므로 NetworkFirst
      {
        urlPattern: /^https?.*\/api\/stores(\?.*)?$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "api-stores",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 5 * 60, // 5분
          },
          networkTimeoutSeconds: 5,
        },
      },
      // 가게 상세 정보 - 상대적으로 안정적이므로 StaleWhileRevalidate
      {
        urlPattern: /^https?.*\/api\/stores\/\d+$/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "api-store-details",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 15 * 60, // 15분
          },
        },
      },
      // 가게 리뷰 - 새 리뷰가 추가될 수 있으므로 NetworkFirst
      {
        urlPattern: /^https?.*\/api\/stores\/\d+\/reviews$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "api-store-reviews",
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 10 * 60, // 10분
          },
          networkTimeoutSeconds: 3,
        },
      },
      // 즐겨찾기 - 사용자별 데이터이므로 NetworkFirst
      {
        urlPattern: /^https?.*\/api\/favorites$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "api-favorites",
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 5 * 60, // 5분
          },
          networkTimeoutSeconds: 3,
        },
      },
      // 내 리뷰 - 사용자별 데이터
      {
        urlPattern: /^https?.*\/api\/my-reviews$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "api-my-reviews",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 10 * 60, // 10분
          },
          networkTimeoutSeconds: 3,
        },
      },
      // 공지사항 - 가끔 업데이트되므로 StaleWhileRevalidate
      {
        urlPattern: /^https?.*\/api\/announcements/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "api-announcements",
          expiration: {
            maxEntries: 30,
            maxAgeSeconds: 30 * 60, // 30분
          },
        },
      },
      // 가게 이미지 - 변하지 않으므로 CacheFirst
      {
        urlPattern: /^https?.*\.(jpg|jpeg|png|gif|webp)$/,
        handler: "CacheFirst",
        options: {
          cacheName: "images",
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7일
          },
        },
      },
    ],
  },
})(nextConfig);
