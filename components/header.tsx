"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, MapPin, Menu, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Sidebar from "@/components/sidebar";
import { supabase } from "@/lib/supabase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
}

export default function Header({ initialSearchValue = "" }: HeaderProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(initialSearchValue);
  const [user, setUser] = useState<any>(null);
  const [username, setUsername] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSearchQuery(initialSearchValue);
  }, [initialSearchValue]);

  // 사용자 정보 가져오기
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // 프로필 정보 가져오기
        const { data: profile } = await supabase
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
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);

        if (session?.user) {
          // 프로필 정보 가져오기
          const { data: profile } = await supabase
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

  // e 파라미터의 타입을 명시적으로 지정
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleGetCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        router.push(`/?lat=${latitude}&lng=${longitude}`);
      },
      (error) => {
        console.error("Geolocation error:", error);
      }
    );
  };

  // Sidebar에 필요한 onApplyFilters 함수 구현
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

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
      <div className="flex items-center gap-3 md:gap-6">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5 text-[#333333]" />
              <span className="sr-only">메뉴</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80">
            {/* onApplyFilters props 전달 */}
            <Sidebar onApplyFilters={handleApplyFilters} />
          </SheetContent>
        </Sheet>

        <Link href="/" className="text-xl font-bold text-[#FF5722]">
          Refill Spot
        </Link>
      </div>

      <form
        onSubmit={handleSearch}
        className="flex-1 max-w-md mx-auto relative"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="원하는 지역 또는 식당 이름을 입력하세요"
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
            <span className="sr-only">현재 위치</span>
          </Button>
        </div>
      </form>

      {!loading && (
        <>
          {user ? (
            // 로그인된 경우
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="hidden md:flex gap-2">
                  <User className="h-4 w-4" />
                  <span>{username || user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* 'as'와 'href' 속성 대신 onClick 핸들러 사용 */}
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  내 프로필
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/favorites")}>
                  즐겨찾기
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-500"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            // 로그인되지 않은 경우
            <Link href="/login">
              <Button variant="outline" className="hidden md:flex gap-2">
                <User className="h-4 w-4" />
                <span>로그인</span>
              </Button>
            </Link>
          )}
        </>
      )}
    </header>
  );
}
