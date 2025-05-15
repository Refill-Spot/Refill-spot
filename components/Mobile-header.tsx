"use client";

import { useState, useEffect } from "react";
import { MenuIcon, Search, X, User, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/use-translation";

interface MobileHeaderProps {
  onSearch?: (query: string) => void;
  onLocationRequest?: () => void;
}

export default function MobileHeader({
  onSearch,
  onLocationRequest,
}: MobileHeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim() && onSearch) {
      onSearch(searchQuery.trim());
      setIsSearchOpen(false);
    }
  };

  const handleLocationRequest = () => {
    if (onLocationRequest) {
      onLocationRequest();
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-white border-b border-gray-200 px-4 py-2 h-14 md:hidden">
      <div className="flex items-center gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("menu")}>
              <MenuIcon className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[250px] p-0">
            <SheetHeader className="p-4 border-b">
              <SheetTitle className="text-left">{t("menu")}</SheetTitle>
            </SheetHeader>
            <div className="py-4">
              <nav className="space-y-1">
                <Link
                  href="/"
                  className="flex items-center px-4 py-2 hover:bg-gray-100"
                >
                  {t("home")}
                </Link>
                <Link
                  href="/search"
                  className="flex items-center px-4 py-2 hover:bg-gray-100"
                >
                  {t("search")}
                </Link>
                {user ? (
                  <>
                    <Link
                      href="/profile"
                      className="flex items-center px-4 py-2 hover:bg-gray-100"
                    >
                      {t("profile")}
                    </Link>
                    <Link
                      href="/favorites"
                      className="flex items-center px-4 py-2 hover:bg-gray-100"
                    >
                      {t("favorites")}
                    </Link>
                    <button
                      onClick={() => signOut()}
                      className="flex w-full items-center px-4 py-2 hover:bg-gray-100 text-left text-red-500"
                    >
                      {t("logout")}
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    className="flex items-center px-4 py-2 hover:bg-gray-100"
                  >
                    {t("login")}
                  </Link>
                )}
              </nav>
            </div>
          </SheetContent>
        </Sheet>

        <Link href="/" className="font-bold text-xl text-[#FF5722]">
          Refill Spot
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLocationRequest}
          aria-label={t("current_location")}
        >
          <MapPin className="h-5 w-5 text-[#2196F3]" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSearchOpen(true)}
          aria-label={t("search")}
        >
          <Search className="h-5 w-5" />
        </Button>

        {user ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/profile")}
            aria-label={t("profile")}
          >
            <User className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/login")}
            className="text-xs"
          >
            {t("login")}
          </Button>
        )}
      </div>

      {/* 모바일 검색 오버레이 */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-white z-40 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">{t("search")}</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSearchOpen(false)}
              aria-label={t("close")}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative">
              <Input
                type="text"
                placeholder={t("search_placeholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2"
                autoFocus
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
            <Button
              type="submit"
              className="w-full bg-[#FF5722] hover:bg-[#E64A19]"
            >
              {t("search")}
            </Button>
          </form>
        </div>
      )}
    </header>
  );
}
