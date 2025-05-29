import "./globals.css";
import type { Metadata } from "next";
import Image from "next/image";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import GoogleMapsLoader from "@/components/GoogleMapsLoader";
import { ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Refill Spot - 무한리필 식당 찾기",
  description: "주변의 무한리필 식당을 쉽게 찾아보세요",
  generator: "v0.dev",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko" suppressHydrationWarning>
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
