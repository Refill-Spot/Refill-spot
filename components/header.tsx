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
import { resetOnboardingStatus } from "@/lib/onboarding-storage";
import { LogOut, Map, User } from "lucide-react";
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
}

export default function Header({
  initialSearchValue = "",
  onSearch,
  onLocationRequest,
  onCustomLocationSet,
  userLocation,
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
      resetOnboardingStatus();
      router.push("/");
    } catch (error) {
      console.error("로그아웃 오류:", error);
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

  const handleApplyFilters = (filters: FilterOptions) => {
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
    // 필터 클릭 로직
    console.log("Filter clicked"); // 임시 구현
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 데스크톱 헤더 */}
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

          {/* 모바일 헤더 */}
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

          {/* 사용자 메뉴 (공통) */}
          <div className="flex items-center space-x-4">
            {loading ? (
              <div className="animate-pulse">
                <div className="h-8 w-8 bg-gray-300 rounded-full"></div>
              </div>
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative">
                    <User className="h-5 w-5" />
                    {profile?.username && (
                      <span className="ml-2 hidden md:inline">
                        {profile.username}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <button
                      onClick={handleGetCurrentLocation}
                      className="w-full flex items-center"
                    >
                      <Map className="h-4 w-4 mr-2" />
                      현재 위치로 이동
                    </button>
                  </DropdownMenuItem>
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
                onClick={() => router.push("/auth")}
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
          <Sidebar onApplyFilters={handleApplyFilters} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
