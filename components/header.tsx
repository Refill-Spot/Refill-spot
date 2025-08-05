"use client";

import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useGooglePlaces } from "@/hooks/use-google-places";
import { useLocationSearch } from "@/hooks/use-location-search";
import { Heart, LogOut, Map, Settings, User, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DesktopHeader } from "./header/desktop-header";
import { MobileHeader } from "./header/mobile-header";

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
  onCustomLocationSet?: (lat: number, lng: number, radius: number) => void;
  userLocation?: { lat: number; lng: number } | null;
  onFilterToggle?: () => void;
  onApplyFilters?: (filters: FilterOptions) => void;
}

export default function Header({
  initialSearchValue = "",
  onSearch,
  onLocationRequest,
  onCustomLocationSet,
  userLocation,
  onFilterToggle,
  onApplyFilters,
}: HeaderProps) {
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState(initialSearchValue);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [currentLocationInfo, setCurrentLocationInfo] = useState<{
    address: string;
    distance: number;
  } | null>(null);

  const { getLocationQuick } = useGeolocation();

  // 위치 검색 훅
  const locationSearch = useLocationSearch({
    onCustomLocationSet,
    onDialogClose: () => setIsLocationDialogOpen(false),
  });

  // Google Places 검색 훅
  const googlePlaces = useGooglePlaces({
    onPlaceSelect: locationSearch.handlePlaceSelect,
    onManualSearch: locationSearch.handleManualSearch,
  });

  useEffect(() => {
    setSearchQuery(initialSearchValue);
  }, [initialSearchValue]);

  // 현재 위치 정보 업데이트
  useEffect(() => {
    // 위치가 설정되어 있어도 항상 "위치 설정"으로 표시
    setCurrentLocationInfo(null);
  }, [userLocation]);

  const handleMobileSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("헤더 로그아웃 오류:", error);
    }
  };

  const handleGetCurrentLocation = async () => {
    try {
      const position = await getLocationQuick();
      if (position && onCustomLocationSet) {
        onCustomLocationSet(position.lat, position.lng, 5);
      } else if (position) {
        // URL 업데이트로 위치 변경 (페이지 리로드 없이)
        const url = new URL(window.location.href);
        url.searchParams.set("lat", position.lat.toString());
        url.searchParams.set("lng", position.lng.toString());
        url.searchParams.set("source", "gps");
        window.history.pushState({}, "", url.toString());

        // 페이지 리로드 대신 직접 위치 설정 함수 호출
        if (onCustomLocationSet) {
          onCustomLocationSet(position.lat, position.lng, 5);
        }
      }
    } catch (error) {
      console.error("현재 위치 가져오기 실패:", error);
    }
  };

  const handleApplyFiltersInternal = (filters: FilterOptions) => {
    if (onApplyFilters) {
      onApplyFilters(filters);
    } else {
      const params = new URLSearchParams();

      if (filters.categories && filters.categories.length > 0) {
        params.set("categories", filters.categories.join(","));
      }

      if (filters.maxDistance) {
        params.set("distance", filters.maxDistance.toString());
      }

      if (filters.minRating) {
        params.set("rating", filters.minRating.toString());
      }

      if (filters.latitude && filters.longitude) {
        params.set("lat", filters.latitude.toString());
        params.set("lng", filters.longitude.toString());
      }

      const queryString = params.toString();
      router.push(queryString ? `/?${queryString}` : "/");
    }
  };

  const handleLocationDialogOpen = () => {
    setIsLocationDialogOpen(true);
  };

  const handleLocationDialogClose = () => {
    setIsLocationDialogOpen(false);
  };

  const handleMenuClick = () => {
    // 메뉴 클릭 로직 - 사이드바 토글 등
  };

  const handleFilterClick = () => {
    if (onFilterToggle) {
      onFilterToggle();
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 w-full">
          {/* 데스크톱 헤더 */}
          <div className="hidden lg:flex flex-1">
            <DesktopHeader
              onMenuClick={handleMenuClick}
              onFilterClick={handleFilterClick}
              onCustomLocationSet={onCustomLocationSet}
              currentLocationInfo={currentLocationInfo}
              isLocationDialogOpen={isLocationDialogOpen}
              onLocationDialogOpen={handleLocationDialogOpen}
              onLocationDialogClose={handleLocationDialogClose}
              onPlaceSelect={googlePlaces.handlePredictionSelect}
              onManualSearch={googlePlaces.handleSearch}
            />
          </div>

          {/* 모바일 헤더 */}
          <div className="lg:hidden flex-1">
            <MobileHeader
              onMenuClick={handleMenuClick}
              onFilterClick={handleFilterClick}
              onCustomLocationSet={onCustomLocationSet}
              currentLocationInfo={currentLocationInfo}
              isLocationDialogOpen={isLocationDialogOpen}
              onLocationDialogOpen={handleLocationDialogOpen}
              onLocationDialogClose={handleLocationDialogClose}
              onPlaceSelect={googlePlaces.handlePredictionSelect}
              onManualSearch={googlePlaces.handleSearch}
            />
          </div>

          {/* 사용자 메뉴 (공통) - 오른쪽 끝 */}
          <div className="flex items-center space-x-4 ml-4">
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <div className="h-8 w-8 bg-gray-300 rounded-full animate-pulse"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-4 w-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                </div>
                <div className="hidden md:flex flex-col">
                  <div className="h-3 w-16 bg-gray-300 rounded animate-pulse mb-1"></div>
                  <div className="h-2 w-12 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative">
                    <User className="h-5 w-5" />
                    {profile?.username ? (
                      <span className="ml-2 hidden md:inline">
                        {profile.username}
                      </span>
                    ) : (
                      <span className="ml-2 hidden md:inline">
                        사용자
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <button
                      onClick={() => router.push("/profile")}
                      className="w-full flex items-center"
                    >
                      <Settings className="h-4 w-4 mr-2 text-[#9C27B0]" />
                      프로필 설정
                    </button>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <button
                      onClick={() => router.push("/favorites")}
                      className="w-full flex items-center"
                    >
                      <Heart className="h-4 w-4 mr-2 text-[#FF5722]" />
                      즐겨찾기한 가게 보기
                    </button>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <button
                      onClick={handleGetCurrentLocation}
                      className="w-full flex items-center"
                    >
                      <Map className="h-4 w-4 mr-2" />
                      현재 위치로 이동
                    </button>
                  </DropdownMenuItem>
                  {profile?.is_admin && (
                    <>
                      <DropdownMenuItem asChild>
                        <button
                          onClick={() => router.push("/admin/announcements")}
                          className="w-full flex items-center text-blue-600"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          공지사항 관리
                        </button>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <button
                          onClick={() => router.push("/admin/contacts")}
                          className="w-full flex items-center text-blue-600"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          문의 관리
                        </button>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <button
                          onClick={() => router.push("/admin/reviews")}
                          className="w-full flex items-center text-blue-600"
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          리뷰 관리
                        </button>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center text-red-600"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      로그아웃
                    </button>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => {
                  const currentUrl = window.location.pathname + window.location.search;
                  router.push(`/login?returnUrl=${encodeURIComponent(currentUrl)}`);
                }}
                variant="outline"
                size="sm"
              >
                로그인
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 사이드바 */}
      <Sheet>
        <SheetTrigger asChild>
          <div className="hidden" />
        </SheetTrigger>
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle>메뉴</SheetTitle>
          </SheetHeader>
          <Sidebar onApplyFilters={handleApplyFiltersInternal} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
