"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import Header from "@/components/header";
import KakaoMap from "@/components/kakao-map";
import SearchFilters from "@/components/search-filters";
import { StoreListSkeleton } from "@/components/skeleton-loader";
import StoreList from "@/components/store-list";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useGeolocation } from "@/hooks/use-geolocation";
import {
  getUserLocation,
  isLocationValid,
  saveUserLocation,
} from "@/lib/location-storage";
import { apiLogger, geolocationLogger } from "@/lib/logger";
import { Store } from "@/types/store";
import { useRouter, useSearchParams } from "next/navigation";
import {
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

// 메모이제이션된 StoreList 컴포넌트
const MemoizedStoreList = memo(StoreList);

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const geolocation = useGeolocation();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);

  // 지도 및 페이지네이션 관련 상태
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const { toast } = useToast();

  // 가게 목록 가져오기 (페이지네이션 지원)
  const fetchStores = useCallback(
    async (
      lat?: number,
      lng?: number,
      radius?: number,
      minRating?: number,
      categories?: string[],
      page: number = 1,
      append: boolean = false,
      query?: string,
    ) => {
      apiLogger.debug("fetchStores 호출됨", {
        lat: lat?.toFixed(8),
        lng: lng?.toFixed(8),
        radius,
        page,
        append,
        minRating,
        categories,
        query,
      });

      if (!append) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        let url = "/api/stores";
        if (lat && lng) {
          const params = new URLSearchParams({
            lat: lat.toString(),
            lng: lng.toString(),
            radius: (radius || 5).toString(),
            page: page.toString(),
            limit: "20",
          });

          if (minRating && minRating > 0) {
            params.append("minRating", minRating.toString());
          }

          if (categories && categories.length > 0) {
            params.append("categories", categories.join(","));
          }

          if (query?.trim()) {
            params.append("query", query.trim());
          }

          url += `?${params.toString()}`;
        }

        apiLogger.debug("API 요청 URL", { url });
        apiLogger.debug("API 요청 파라미터", {
          lat: lat,
          lng: lng,
          radius: radius || 5,
          page: page,
          limit: "20",
          minRating,
          categories,
          query,
        });

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

        apiLogger.debug("API 응답 상태", { status: response.status });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `HTTP error! status: ${response.status} - ${errorText}`,
          );
        }

        const data = await response.json();
        apiLogger.debug("API 응답 데이터", data);

        if (!data.success || data.error) {
          throw new Error(
            data.error?.message ||
              "가게 정보를 불러오는 중 오류가 발생했습니다.",
          );
        }

        const storeData = data.data || [];
        const pagination = data.pagination || {};

        apiLogger.debug("가게 데이터 개수", { count: storeData.length });

        if (append) {
          setStores((prevStores) => [...prevStores, ...storeData]);
          setAllStores((prevStores) => [...prevStores, ...storeData]);
        } else {
          setStores(storeData);
          setAllStores(storeData);
        }

        setHasMore(pagination.hasMore || false);
        setCurrentPage(pagination.page || 1);

        if (storeData.length === 0 && !append) {
          toast({
            title: "알림",
            description: "해당 지역에 등록된 가게가 없습니다.",
          });
        }
      } catch (err) {
        apiLogger.error("fetchStores 오류:", err);
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
        setLoadingMore(false);
      }
    },
    [toast],
  );

  // 더보기 함수
  const loadMoreStores = useCallback(() => {
    if (!userLocation || loadingMore || !hasMore) {
      return;
    }

    // 현재 URL 파라미터에서 필터 정보 추출
    const currentCategories = searchParams.get("categories");
    const currentDistance = searchParams.get("distance");
    const currentRating =
      searchParams.get("rating") || searchParams.get("minRating");
    const currentQuery = searchParams.get("q") || searchParams.get("query");

    const nextPage = currentPage + 1;
    fetchStores(
      userLocation.lat,
      userLocation.lng,
      currentDistance ? parseFloat(currentDistance) : 5,
      currentRating ? parseFloat(currentRating) : undefined,
      currentCategories ? currentCategories.split(",") : undefined,
      nextPage,
      true,
      currentQuery || undefined,
    );
  }, [userLocation, loadingMore, hasMore, currentPage, searchParams]);

  // 온보딩 체크 (첫 방문자용으로만 동작)
  useEffect(() => {
    // 온보딩 체크를 비활성화하고 바로 메인 페이지 진행
    const checkOnboarding = () => {
      try {
        // 로그인한 사용자는 온보딩을 건너뛰고 바로 메인 페이지로
        setIsCheckingOnboarding(false);
      } catch (error) {
        apiLogger.error("온보딩 체크 중 오류:", error);
        setIsCheckingOnboarding(false);
      }
    };

    // 클라이언트 사이드에서만 실행
    if (typeof window !== "undefined") {
      // 약간의 지연을 두어 렌더링 완료 후 실행
      setTimeout(checkOnboarding, 100);
    }
  }, [router]);

  // 초기 로드
  useEffect(() => {
    // 온보딩 체크가 완료되지 않았으면 대기
    if (isCheckingOnboarding) {
      return;
    }

    const loadInitialData = async () => {
      // URL 파라미터에서 검색어 확인
      const searchQuery = searchParams.get("search");
      let hasSearchQuery = false;

      if (searchQuery) {
        hasSearchQuery = true;
      }

      // URL 파라미터에서 위치 정보 및 필터 정보 확인
      const urlLat = searchParams.get("lat");
      const urlLng = searchParams.get("lng");
      const urlCategories = searchParams.get("categories");
      const urlDistance = searchParams.get("distance");
      const urlRating = searchParams.get("rating");
      const urlQuery = searchParams.get("q");
      const urlSource = searchParams.get("source") as
        | "gps"
        | "manual"
        | "default"
        | null;
      const searchLocation = searchParams.get("searchLocation");

      if (urlLat && urlLng) {
        // URL 파라미터에 위치 정보가 있으면 사용
        const lat = parseFloat(urlLat);
        const lng = parseFloat(urlLng);

        if (!isNaN(lat) && !isNaN(lng)) {
          setUserLocation({ lat, lng });
          setCurrentPage(1);
          setHasMore(false);

          // URL 파라미터에서 필터 정보 추출
          const radius = urlDistance ? parseFloat(urlDistance) : 5;
          const minRating = urlRating ? parseFloat(urlRating) : undefined;
          const categories = urlCategories
            ? urlCategories.split(",")
            : undefined;
          const query = urlQuery || undefined;

          await fetchStores(
            lat,
            lng,
            radius,
            minRating,
            categories,
            1,
            false,
            query,
          );

          // URL 파라미터의 위치 정보를 저장
          saveUserLocation({
            lat,
            lng,
            source: urlSource || "manual",
          });

          const sourceText = searchLocation
            ? `${searchLocation}`
            : urlSource === "gps"
              ? "현재 위치"
              : urlSource === "manual"
                ? "설정한 위치"
                : "이전 위치";

          // 필터 적용 메시지 생성
          const filterDesc = [];
          if (radius !== 5) {
            filterDesc.push(`반경 ${radius}km`);
          }
          if (minRating && minRating > 0) {
            filterDesc.push(`평점 ${minRating}점 이상`);
          }
          if (categories && categories.length > 0) {
            filterDesc.push(`카테고리: ${categories.join(", ")}`);
          }
          if (query) {
            filterDesc.push(`검색어: "${query}"`);
          }

          toast({
            title: "위치 설정 완료",
            description:
              filterDesc.length > 0
                ? `${sourceText} 주변에서 ${filterDesc.join(", ")} 조건으로 검색합니다.`
                : `${sourceText} 주변의 가게를 표시합니다.`,
          });
          return;
        }
      }

      // URL 파라미터가 없으면 저장된 위치 정보 복원 시도
      const savedLocation = getUserLocation();

      if (savedLocation && isLocationValid(savedLocation)) {
        // 저장된 위치 정보가 있으면 사용
        setUserLocation({ lat: savedLocation.lat, lng: savedLocation.lng });
        await fetchStores(savedLocation.lat, savedLocation.lng, 5);

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
        // 저장된 위치 정보가 없으면 기본 위치 사용 (강남역 - 헬로 브라질강남역 좌표)
        const defaultLocation = {
          lat: 37.5006249,
          lng: 127.0277083,
        };

        geolocationLogger.info(
          "기본 위치 설정 (서울 강남구 중심)",
          defaultLocation,
        );
        setUserLocation(defaultLocation);
        await fetchStores(defaultLocation.lat, defaultLocation.lng, 10);

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
    };

    loadInitialData();
  }, [searchParams, toast, isCheckingOnboarding]);

  // 검색어 파라미터 처리 (별도 useEffect)
  useEffect(() => {
    const searchQuery = searchParams.get("search");

    if (searchQuery && !loading && allStores.length > 0) {
      const filteredStores = allStores.filter(
        (store) =>
          store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          store.address.toLowerCase().includes(searchQuery.toLowerCase()),
      );

      setStores(filteredStores);

      if (filteredStores.length === 0) {
        toast({
          title: "검색 결과 없음",
          description: "검색 조건에 맞는 가게가 없습니다.",
        });
      } else {
        toast({
          title: "검색 완료",
          description: `"${searchQuery}" 검색 결과 ${filteredStores.length}개를 표시합니다.`,
        });
      }
    }
  }, [searchParams, loading, allStores, toast]);

  // 현재 위치 가져오기 요청
  const handleGetCurrentLocation = useCallback(async () => {
    try {
      const coordinates = await geolocation.getCurrentPosition({
        saveToStorage: true,
        source: "gps",
        showToast: true,
        customSuccessMessage: "현재 위치 주변의 가게를 표시합니다.",
      });

      setUserLocation(coordinates);
      fetchStores(coordinates.lat, coordinates.lng, 5);

      // 지도에 위치 업데이트
    } catch (error) {
      // 에러는 useGeolocation 훅에서 이미 처리됨
      geolocationLogger.error("위치 정보 가져오기 실패:", error);
    }
  }, [geolocation, fetchStores]);

  // 사용자 지정 위치 설정
  const setCustomLocation = useCallback(
    (lat: number, lng: number, radius: number = 5) => {
      geolocationLogger.debug("수동 검색으로 위치 설정", {
        lat: lat.toFixed(8),
        lng: lng.toFixed(8),
        radius,
      });

      // 위치 설정과 동시에 가게 데이터 fetch
      setUserLocation({ lat, lng });
      setCurrentPage(1);
      setHasMore(false);

      fetchStores(lat, lng, radius, undefined, undefined, 1, false);

      // 수동 설정 위치 정보 저장
      saveUserLocation({
        lat,
        lng,
        source: "manual",
      });

      // 지도에 위치 업데이트

      toast({
        title: "위치 설정 완료",
        description: "설정한 위치 주변의 가게를 표시합니다.",
      });
    },
    [toast, fetchStores],
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
          store.address.toLowerCase().includes(query.toLowerCase()),
      );

      setStores(filteredStores);

      if (filteredStores.length === 0) {
        toast({
          title: "검색 결과 없음",
          description: "검색 조건에 맞는 가게가 없습니다.",
        });
      }
    },
    [stores, userLocation, toast],
  );

  // 사이드바 필터 적용
  const handleApplyFilters = useCallback(
    (filters: {
      categories?: string[];
      maxDistance?: number;
      minRating?: number;
      latitude?: number;
      longitude?: number;
      query?: string;
    }) => {
      apiLogger.debug("필터 적용", filters);

      // 위치 정보 결정 (필터에서 제공된 위치 또는 현재 사용자 위치)
      const lat = filters.latitude || userLocation?.lat;
      const lng = filters.longitude || userLocation?.lng;
      const radius = filters.maxDistance || 5;

      if (lat && lng) {
        // 위치 정보가 필터에서 제공된 경우 사용자 위치 업데이트
        if (filters.latitude && filters.longitude) {
          setUserLocation({ lat: filters.latitude, lng: filters.longitude });

          // 위치 정보 저장
          saveUserLocation({
            lat: filters.latitude,
            lng: filters.longitude,
            source: "gps",
          });
        }

        // 필터가 적용된 조건으로 가게 목록 다시 로드 (페이지 초기화)
        setCurrentPage(1);
        setHasMore(false);
        fetchStores(
          lat,
          lng,
          radius,
          filters.minRating,
          filters.categories,
          1,
          false,
          filters.query,
        );

        // 검색어 필터링은 서버에서 처리되므로 클라이언트 사이드 필터링 제거

        const filterDesc = [];
        if (radius !== 5) {
          filterDesc.push(`반경 ${radius}km`);
        }
        if (filters.minRating && filters.minRating > 0) {
          filterDesc.push(`평점 ${filters.minRating}점 이상`);
        }
        if (filters.categories && filters.categories.length > 0) {
          filterDesc.push(`카테고리: ${filters.categories.join(", ")}`);
        }
        if (filters.query) {
          filterDesc.push(`검색어: "${filters.query}"`);
        }

        // 위치 변경 여부 확인
        const locationChanged = filters.latitude && filters.longitude;

        toast({
          title: locationChanged ? "위치 및 필터 적용 완료" : "필터 적용 완료",
          description: locationChanged
            ? "현재 위치로 이동하여 " +
              (filterDesc.length > 0
                ? filterDesc.join(", ") + " 조건으로 검색합니다."
                : "모든 조건으로 검색합니다.")
            : filterDesc.length > 0
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
    [userLocation, toast, fetchStores],
  );

  // 필터 토글 핸들러
  const handleFilterToggle = useCallback(() => {
    setIsFilterOpen(!isFilterOpen);
  }, [isFilterOpen]);

  // 사이드바 콘텐츠 컴포넌트 (가게 목록만)
  const SidebarContent = useMemo(() => {
    return (
      <div className="h-full flex flex-col">
        {/* 가게 목록 헤더 */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">가게 목록</h3>
          {stores.length > 0 && (
            <p className="text-sm text-gray-600 mt-1">
              총{" "}
              <span className="font-semibold text-[#FF5722]">
                {stores.length}
              </span>
              개의 가게
            </p>
          )}
        </div>

        {/* 가게 목록 */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {loading ? (
            <StoreListSkeleton />
          ) : error ? (
            <div className="flex items-center justify-center h-full p-4">
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
            <div className="pb-4">
              <MemoizedStoreList stores={stores} />

              {/* 더보기 버튼 */}
              {hasMore && !loading && !error && (
                <div className="p-4">
                  <Button
                    onClick={loadMoreStores}
                    disabled={loadingMore}
                    className="w-full bg-[#FF5722] hover:bg-[#E64A19]"
                  >
                    {loadingMore ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        로딩 중...
                      </>
                    ) : (
                      `더보기 (${stores.length}개 표시됨)`
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }, [
    loading,
    error,
    stores,
    hasMore,
    loadingMore,
    loadMoreStores,
    fetchStores,
  ]);

  // 뷰 모드별 컴포넌트 메모이제이션
  const MapView = useMemo(() => {
    return (
      <div className="w-full h-full">
        {loading ? (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5722] mx-auto mb-4"></div>
              <p className="text-gray-600">지도 로딩 중...</p>
            </div>
          </div>
        ) : error ? (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-500 mb-4">지도를 불러올 수 없습니다</p>
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
          <KakaoMap
            key={
              userLocation
                ? `map-${userLocation.lat.toFixed(6)}-${userLocation.lng.toFixed(6)}`
                : "map-default"
            }
            stores={allStores}
            userLocation={userLocation}
            enableClustering={true}
            selectedStore={selectedStore}
            onStoreSelect={setSelectedStore}
            onLocationChange={() => {}} // 위치 변경 시 아무 작업 안함 (자동 검색 비활성화)
            onManualSearch={setCustomLocation} // 수동 검색 시 위치 업데이트 및 데이터 로드
            isVisible={true}
          />
        )}
      </div>
    );
  }, [
    loading,
    error,
    allStores,
    userLocation,
    selectedStore,
    setCustomLocation,
  ]);

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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Refill-spot
          </h2>
          <p className="text-gray-500">무한리필 가게 찾기</p>
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
          onFilterToggle={handleFilterToggle}
          onApplyFilters={handleApplyFilters}
        />

        <div className="flex flex-1 overflow-hidden">
          {/* 왼쪽 패널 - 가게 목록만 */}
          <div className="hidden lg:block lg:w-[30%] xl:w-[28%] 2xl:w-[25%] border-r border-gray-200 bg-white overflow-hidden">
            {SidebarContent}
          </div>

          {/* 필터 패널 (모바일 + 데스크톱) */}
          {isFilterOpen && (
            <div className="fixed inset-0 z-50 bg-black bg-opacity-50">
              <div className="w-80 lg:w-[25%] xl:w-[22%] 2xl:w-[20%] h-full bg-white overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">필터</h2>
                  <button
                    onClick={() => setIsFilterOpen(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <SearchFilters
                  userLocation={userLocation}
                  onApplyFilters={(filters) => {
                    handleApplyFilters(filters);
                    setIsFilterOpen(false);
                  }}
                />
              </div>
            </div>
          )}

          {/* 메인 콘텐츠 영역 - 지도만 표시 */}
          <div className="flex-1 relative">
            {MapView}

            {/* 결과 요약 */}
            {stores.length > 0 && (
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-sm border z-10">
                <p className="text-sm text-gray-700">
                  총{" "}
                  <span className="font-semibold text-[#FF5722]">
                    {stores.length}
                  </span>
                  개의 가게 표시
                </p>
                {hasMore && (
                  <p className="text-xs text-gray-500 mt-1">
                    더 많은 가게가 있습니다
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </ErrorBoundary>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
