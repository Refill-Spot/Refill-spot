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

export default nextConfig;
