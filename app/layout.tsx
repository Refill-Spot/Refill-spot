import "./globals.css";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ReactNode } from "react"; // React 타입 import 추가

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Refill Spot - 무한리필 식당 찾기",
  description: "주변의 무한리필 식당을 쉽게 찾아보세요",
  generator: "v0.dev",
};

// RootLayout의 props 타입을 명시적으로 지정
interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
