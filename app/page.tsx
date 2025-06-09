"use client";

import { useCallback, useEffect, useState, memo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import StoreList from "@/components/store-list";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { ErrorBoundary } from "@/components/error-boundary";
import { StoreListSkeleton } from "@/components/skeleton-loader";
import { useToast } from "@/hooks/use-toast";
import { Store } from "@/types/store";
import {
  saveUserLocation,
  getUserLocation,
  isLocationValid,
  UserLocation,
} from "@/lib/location-storage";
import { isOnboardingCompleted } from "@/lib/onboarding-storage";

// 메모이제이션된 StoreList 컴포넌트
const MemoizedStoreList = memo(StoreList);

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);

  const { toast } = useToast();

  // 가게 목록 가져오기 (실제 API 사용)
  const fetchStores = useCallback(
    async (
      lat?: number,
      lng?: number,
      radius?: number,
      minRating?: number,
      categories?: string[]
    ) => {
      setLoading(true);
      setError(null);

      try {
        let url = "/api/stores";
        if (lat && lng) {
          const params = new URLSearchParams({
            lat: lat.toString(),
            lng: lng.toString(),
            radius: (radius || 5).toString(),
          });

          if (minRating && minRating > 0) {
            params.append("minRating", minRating.toString());
          }

          if (categories && categories.length > 0) {
            params.append("categories", categories.join(","));
          }

          url += `?${params.toString()}`;
        }

        // 타임아웃 설정 (10초)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "Cache-Control": "no-cache",
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `HTTP error! status: ${response.status} - ${errorText}`
          );
        }

        const data = await response.json();

        if (!data.success || data.error) {
          throw new Error(
            data.error?.message ||
              "가게 정보를 불러오는 중 오류가 발생했습니다."
          );
        }

        const storeData = data.data || [];
        setStores(storeData);

        if (storeData.length === 0) {
          toast({
            title: "알림",
            description: "해당 지역에 등록된 가게가 없습니다.",
          });
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setError("요청 시간이 초과되었습니다. 다시 시도해주세요.");
          toast({
            title: "시간 초과",
            description:
              "요청 시간이 초과되었습니다. 네트워크 상태를 확인해주세요.",
            variant: "destructive",
          });
        } else {
          const errorMessage =
            err instanceof Error
              ? err.message
              : "알 수 없는 오류가 발생했습니다.";
          setError(errorMessage);
          toast({
            title: "오류",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // 온보딩 체크
  useEffect(() => {
    // 온보딩 완료 여부 확인
    const checkOnboarding = () => {
      if (!isOnboardingCompleted()) {
        router.push("/onboarding");
        return;
      }
      setIsCheckingOnboarding(false);
    };

    // 클라이언트 사이드에서만 실행
    if (typeof window !== "undefined") {
      checkOnboarding();
    }
  }, [router]);

  // 초기 로드
  useEffect(() => {
    // 온보딩 체크가 완료되지 않았으면 대기
    if (isCheckingOnboarding) {
      return;
    }

    // URL 파라미터에서 위치 정보 확인
    const urlLat = searchParams.get("lat");
    const urlLng = searchParams.get("lng");
    const urlSource = searchParams.get("source") as
      | "gps"
      | "manual"
      | "default"
      | null;

    if (urlLat && urlLng) {
      // URL 파라미터에 위치 정보가 있으면 사용
      const lat = parseFloat(urlLat);
      const lng = parseFloat(urlLng);

      if (!isNaN(lat) && !isNaN(lng)) {
        setUserLocation({ lat, lng });
        fetchStores(lat, lng, 5);

        // URL 파라미터의 위치 정보를 저장
        saveUserLocation({
          lat,
          lng,
          source: urlSource || "manual",
        });

        const sourceText =
          urlSource === "gps"
            ? "현재 위치"
            : urlSource === "manual"
            ? "설정한 위치"
            : "이전 위치";

        toast({
          title: "위치 복원 완료",
          description: `${sourceText} 주변의 가게를 표시합니다.`,
        });
        return;
      }
    }

    // URL 파라미터가 없으면 저장된 위치 정보 복원 시도
    const savedLocation = getUserLocation();

    if (savedLocation && isLocationValid(savedLocation)) {
      // 저장된 위치 정보가 있으면 사용
      setUserLocation({ lat: savedLocation.lat, lng: savedLocation.lng });
      fetchStores(savedLocation.lat, savedLocation.lng, 5);

      const sourceText =
        savedLocation.source === "gps"
          ? "현재 위치"
          : savedLocation.source === "manual"
          ? "설정한 위치"
          : "기본 위치";

      toast({
        title: "위치 복원 완료",
        description: `이전에 설정한 ${sourceText} 주변의 가게를 표시합니다.`,
      });
    } else {
      // 저장된 위치 정보가 없으면 기본 위치 사용
      const defaultLocation = {
        lat: 37.498095,
        lng: 127.02761,
      };

      setUserLocation(defaultLocation);
      fetchStores(defaultLocation.lat, defaultLocation.lng, 5);

      // 기본 위치 저장
      saveUserLocation({
        lat: defaultLocation.lat,
        lng: defaultLocation.lng,
        source: "default",
      });

      toast({
        title: "기본 위치 적용",
        description:
          "서울 강남역 주변의 가게를 표시합니다. 위치 버튼을 눌러 현재 위치로 변경할 수 있습니다.",
      });
    }
  }, [searchParams, fetchStores, toast, isCheckingOnboarding]);

  // 현재 위치 가져오기 요청
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "위치 정보 오류",
        description: "이 브라우저에서는 위치 정보를 지원하지 않습니다.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "위치 정보",
      description: "현재 위치를 확인 중입니다...",
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        setUserLocation({ lat: latitude, lng: longitude });
        fetchStores(latitude, longitude, 5);

        // GPS 위치 정보 저장
        saveUserLocation({
          lat: latitude,
          lng: longitude,
          source: "gps",
        });

        toast({
          title: "위치 확인 완료",
          description: `현재 위치 주변의 가게를 표시합니다.`,
        });
      },
      (error) => {
        let errorMessage = "위치 정보를 가져올 수 없습니다.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage =
              "위치 접근 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "위치 정보를 사용할 수 없습니다.";
            break;
          case error.TIMEOUT:
            errorMessage = "위치 정보 요청 시간이 초과되었습니다.";
            break;
        }

        toast({
          title: "위치 정보 확인 불가",
          description: errorMessage + " 기본 지역의 가게를 표시합니다.",
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // 사용자 지정 위치 설정
  const setCustomLocation = useCallback(
    (lat: number, lng: number, radius: number = 5) => {
      setUserLocation({ lat, lng });
      fetchStores(lat, lng, radius);

      // 수동 설정 위치 정보 저장
      saveUserLocation({
        lat,
        lng,
        source: "manual",
      });

      toast({
        title: "위치 설정 완료",
        description: "설정한 위치 주변의 가게를 표시합니다.",
      });
    },
    [fetchStores, toast]
  );

  // 검색 처리
  const handleSearch = useCallback(
    (query: string) => {
      if (!query.trim()) {
        // 검색어가 없으면 기본 위치로 다시 로드
        fetchStores(userLocation?.lat, userLocation?.lng, 5);
        return;
      }

      // 검색어가 있으면 현재 가게 목록에서 필터링
      const filteredStores = stores.filter(
        (store) =>
          store.name.toLowerCase().includes(query.toLowerCase()) ||
          store.address.toLowerCase().includes(query.toLowerCase())
      );

      setStores(filteredStores);

      if (filteredStores.length === 0) {
        toast({
          title: "검색 결과 없음",
          description: "검색 조건에 맞는 가게가 없습니다.",
        });
      }
    },
    [stores, fetchStores, userLocation, toast]
  );

  // 사이드바 필터 적용
  const handleApplyFilters = useCallback(
    (filters: {
      categories?: string[];
      maxDistance?: number;
      minRating?: number;
      latitude?: number;
      longitude?: number;
    }) => {
      console.log("필터 적용:", filters);

      // 위치 정보 결정 (필터에서 제공된 위치 또는 현재 사용자 위치)
      const lat = filters.latitude || userLocation?.lat;
      const lng = filters.longitude || userLocation?.lng;
      const radius = filters.maxDistance || 5;

      if (lat && lng) {
        // 필터가 적용된 조건으로 가게 목록 다시 로드
        fetchStores(lat, lng, radius, filters.minRating, filters.categories);

        const filterDesc = [];
        if (radius !== 5) filterDesc.push(`반경 ${radius}km`);
        if (filters.minRating && filters.minRating > 0)
          filterDesc.push(`평점 ${filters.minRating}점 이상`);
        if (filters.categories && filters.categories.length > 0)
          filterDesc.push(`카테고리: ${filters.categories.join(", ")}`);

        toast({
          title: "필터 적용 완료",
          description:
            filterDesc.length > 0
              ? filterDesc.join(", ") + " 조건으로 검색합니다."
              : "모든 조건으로 검색합니다.",
        });
      } else {
        toast({
          title: "위치 정보 필요",
          description: "필터를 적용하려면 위치 정보가 필요합니다.",
          variant: "destructive",
        });
      }
    },
    [fetchStores, userLocation, toast]
  );

  // 온보딩 체크 중이면 로딩 화면 표시
  if (isCheckingOnboarding) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mb-4 mx-auto animate-pulse">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6l4 2"
              />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Refill Spot
          </h2>
          <p className="text-gray-500">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary fallback={<div className="p-4">오류가 발생했습니다.</div>}>
      <main className="flex flex-col h-screen bg-[#F5F5F5]">
        <Header
          onSearch={handleSearch}
          onLocationRequest={handleGetCurrentLocation}
          onCustomLocationSet={setCustomLocation}
          userLocation={userLocation}
        />
        <div className="flex flex-1 overflow-hidden">
          {/* 사이드바 - 데스크톱에서만 표시 */}
          <div className="hidden lg:block w-80 border-r border-gray-200 overflow-y-auto bg-white">
            <Sidebar
              onApplyFilters={handleApplyFilters}
              userLocation={userLocation}
            />
          </div>

          {/* 메인 콘텐츠 영역 - 가게 목록 전체 화면 */}
          <div className="flex-1 relative">
            {/* 가게 목록 */}
            <div className="h-full">
              {loading ? (
                <StoreListSkeleton />
              ) : error ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-red-500 mb-4">{error}</p>
                    <button
                      onClick={() =>
                        fetchStores(userLocation?.lat, userLocation?.lng, 5)
                      }
                      className="px-4 py-2 bg-[#FF5722] text-white rounded-md hover:bg-[#E64A19] transition-colors"
                    >
                      다시 시도
                    </button>
                  </div>
                </div>
              ) : (
                <MemoizedStoreList stores={stores} />
              )}
            </div>

            {/* 결과 요약 */}
            {stores.length > 0 && (
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-sm border">
                <p className="text-sm text-gray-700">
                  총{" "}
                  <span className="font-semibold text-[#FF5722]">
                    {stores.length}
                  </span>
                  개의 가게
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </ErrorBoundary>
  );
}
