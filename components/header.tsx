"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, MapPin, Menu, User, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Sidebar from "@/components/sidebar";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/hooks/use-translation";

// 필터 타입 정의
interface FilterOptions {
  categories?: string[];
  maxDistance?: number;
  minRating?: number;
  latitude?: number;
  longitude?: number;
}

interface HeaderProps {
  initialSearchValue?: string;
  onSearch?: (query: string) => void;
  onLocationRequest?: () => void;
}

export default function Header({
  initialSearchValue = "",
  onSearch,
  onLocationRequest,
}: HeaderProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState(initialSearchValue);
  const [user, setUser] = useState<any>(null);
  const [username, setUsername] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    setSearchQuery(initialSearchValue);
  }, [initialSearchValue]);

  // 사용자 정보 가져오기
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabaseBrowser.auth.getUser();
      setUser(user);

      if (user) {
        // 프로필 정보 가져오기
        const { data: profile } = await supabaseBrowser
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .single();

        if (profile) {
          setUsername(profile.username);
        }
      }

      setLoading(false);
    };

    getUser();

    // 인증 상태 변경 리스너
    const { data: authListener } = supabaseBrowser.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);

        if (session?.user) {
          // 프로필 정보 가져오기
          const { data: profile } = await supabaseBrowser
            .from("profiles")
            .select("username")
            .eq("id", session.user.id)
            .single();

          if (profile) {
            setUsername(profile.username);
          }
        } else {
          setUsername("");
        }

        setLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // 모바일 검색 처리
  const handleMobileSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (onSearch) {
        onSearch(searchQuery.trim());
      } else {
        router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      }
      setIsSearchOpen(false);
    }
  };

  // 데스크탑 검색 처리
  const handleDesktopSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (onSearch) {
        onSearch(searchQuery.trim());
      } else {
        router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      }
    }
  };

  // 로그아웃 처리
  const handleLogout = async () => {
    await supabaseBrowser.auth.signOut();
    router.push("/");
  };

  // 현재 위치 요청 처리
  const handleGetCurrentLocation = () => {
    if (onLocationRequest) {
      onLocationRequest();
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          router.push(`/?lat=${latitude}&lng=${longitude}`);
        },
        (error) => {
          console.error("Geolocation error:", error);
        }
      );
    }
  };

  // 사이드바 필터 적용
  const handleApplyFilters = (filters: FilterOptions) => {
    // 필터를 적용하고 검색 페이지로 이동
    const queryParams = new URLSearchParams();

    if (filters.categories && filters.categories.length > 0) {
      queryParams.set("categories", filters.categories.join(","));
    }

    if (filters.maxDistance) {
      queryParams.set("distance", filters.maxDistance.toString());
    }

    if (filters.minRating) {
      queryParams.set("rating", filters.minRating.toString());
    }

    if (filters.latitude && filters.longitude) {
      queryParams.set("lat", filters.latitude.toString());
      queryParams.set("lng", filters.longitude.toString());
    }

    const queryString = queryParams.toString();
    router.push(`/search?${queryString}`);
  };

  // 데스크탑 헤더
  const DesktopHeader = () => (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 hidden md:flex items-center gap-3">
      <div className="flex items-center gap-3 md:gap-6">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5 text-[#333333]" />
              <span className="sr-only">{t("menu")}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80">
            <Sidebar onApplyFilters={handleApplyFilters} />
          </SheetContent>
        </Sheet>

        <Link href="/" className="text-xl font-bold text-[#FF5722]">
          Refill Spot
        </Link>
      </div>

      <form
        onSubmit={handleDesktopSearch}
        className="flex-1 max-w-md mx-auto relative"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder={t("search_placeholder")}
            className="pl-9 pr-9 py-2 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
            onClick={handleGetCurrentLocation}
          >
            <MapPin className="h-4 w-4 text-[#2196F3]" />
            <span className="sr-only">{t("current_location")}</span>
          </Button>
        </div>
      </form>

      {!loading && (
        <>
          {user ? (
            // 로그인된 경우
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex gap-2">
                  <User className="h-4 w-4" />
                  <span>{username || user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  {t("profile")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/favorites")}>
                  {t("favorites")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-500"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            // 로그인되지 않은 경우
            <Link href="/login">
              <Button variant="outline" className="flex gap-2">
                <User className="h-4 w-4" />
                <span>{t("login")}</span>
              </Button>
            </Link>
          )}
        </>
      )}
    </header>
  );

  // 모바일 헤더
  const MobileHeader = () => (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-white border-b border-gray-200 px-4 py-2 h-14 md:hidden">
      <div className="flex items-center gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("menu")}>
              <Menu className="h-5 w-5" />
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
                      onClick={handleLogout}
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
          onClick={handleGetCurrentLocation}
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
          <form onSubmit={handleMobileSearch} className="space-y-4">
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

  return (
    <>
      <DesktopHeader />
      <MobileHeader />
    </>
  );
}
