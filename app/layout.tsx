import GoogleMapsLoader from "@/components/GoogleMapsLoader";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { Inter } from "next/font/google";
import Script from "next/script";
import { ReactNode } from "react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Refill-spot - 무한리필 가게 찾기",
  description: "주변의 무한리필 가게를 쉽게 찾아보세요",
  generator: "v0.dev",
  icons: {
    icon: "/icon",
    apple: "/apple-icon",
  },
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  const adsenseClientId = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT_ID;

  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {adsenseClientId && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <GoogleMapsLoader>
              {children}
              <Toaster />
            </GoogleMapsLoader>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
