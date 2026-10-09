"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import Header from "@/components/header";
import KakaoMap from "@/components/kakao-map";
import SearchFilters from "@/components/search-filters";
import { StoreListSkeleton } from "@/components/skeleton-loader";
import StoreList from "@/components/store-list";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/components/ui/use-toast";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  getUserLocation,
  isLocationValid,
  saveUserLocation,
} from "@/lib/location-storage";
import { apiLogger, geolocationLogger } from "@/lib/logger";
import { reconcileSelectedStore } from "@/lib/map-selection";
import { Store } from "@/types/store";
import { List, Loader2, Map, SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// 메모이제이션된 StoreList 컴포넌트
const MemoizedStoreList = memo(StoreList);

const categories = [
  "고기",
  "해산물",
  "한식",
  "양식",
  "중식",
  "일식",
  "카페",
  "디저트",
];

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

  // 지도 및 페이지네이션 관련 상태
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterUsesSheet, setFilterUsesSheet] = useState(false);
  const [isResultsExpanded, setIsResultsExpanded] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const filterTriggerRef = useRef<HTMLElement | null>(null);
  const resultsToggleRef = useRef<HTMLButtonElement | null>(null);
  const mobileResultsRef = useRef<HTMLDivElement | null>(null);
  const previewTitleRef = useRef<HTMLHeadingElement | null>(null);
  const selectionOriginRef = useRef<{
    element: HTMLElement;
    storeId: number;
    resultsExpanded: boolean;
  } | null>(null);
  const pendingSelectionFocusRef = useRef<"preview" | "results" | null>(null);

  const { toast } = useToast();
  const activeCategories =
    searchParams.get("categories")?.split(",").filter(Boolean) || [];
  const activeConditions = [
    {
      key: "q",
      label: searchParams.get("q") ? `검색: ${searchParams.get("q")}` : null,
    },
    {
      key: "distance",
      label: searchParams.get("distance")
        ? `반경 ${searchParams.get("distance")}km`
        : null,
    },
    {
      key: "rating",
      label:
        Number(searchParams.get("rating")) > 0
          ? `평점 ${searchParams.get("rating")} 이상`
          : null,
    },
  ].filter((condition) => condition.label);

  const removeCondition = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    const queryString = params.toString();
    router.replace(
      queryString
        ? `${window.location.pathname}?${queryString}`
        : window.location.pathname,
      { scroll: false },
    );
  };

  const handleCategorySelect = (category: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    const nextCategories = category
      ? activeCategories.includes(category)
        ? activeCategories.filter((value) => value !== category)
        : [...activeCategories, category]
      : [];

    if (nextCategories.length > 0) {
      params.set("categories", nextCategories.join(","));
    } else {
      params.delete("categories");
    }

    const queryString = params.toString();
    const currentPath = window.location.pathname;
    router.replace(
      queryString ? `${currentPath}?${queryString}` : currentPath,
      {
        scroll: false,
      },
    );
  };

  const handleStoreSelect = useCallback(
    (store: Store | null) => {
      const focusedElement = document.activeElement;
      const focusedResult =
        !isDesktop &&
        focusedElement instanceof HTMLElement &&
        mobileResultsRef.current?.contains(focusedElement)
          ? focusedElement
          : null;
      const restoreResultsFocus =
        !store &&
        !isDesktop &&
        previewTitleRef.current?.closest("section")?.contains(focusedElement);

      if (store) {
        selectionOriginRef.current = focusedResult
          ? {
              element: focusedResult,
              storeId: store.id,
              resultsExpanded: isResultsExpanded,
            }
          : null;
        pendingSelectionFocusRef.current = focusedResult ? "preview" : null;
      } else {
        pendingSelectionFocusRef.current = restoreResultsFocus
          ? "results"
          : null;
      }

      setSelectedStore(store);
      setIsResultsExpanded(
        restoreResultsFocus
          ? (selectionOriginRef.current?.resultsExpanded ?? false)
          : false,
      );
      setIsMapExpanded(Boolean(store));
    },
    [isDesktop, isResultsExpanded],
  );

  useEffect(() => {
    const pendingFocus = pendingSelectionFocusRef.current;
    if (!pendingFocus) {
      return;
    }
    pendingSelectionFocusRef.current = null;
    if (isDesktop) {
      return;
    }

    if (pendingFocus === "preview") {
      const target = selectedStore ? previewTitleRef.current : null;
      (target ?? resultsToggleRef.current)?.focus({ preventScroll: true });
      return;
    }

    const origin = selectionOriginRef.current;
    const result = origin?.element.isConnected
      ? origin.element
      : origin
        ? mobileResultsRef.current?.querySelector<HTMLElement>(
            `[data-store-select-id="${origin.storeId}"]`,
          )
        : null;
    if (result && result.getClientRects().length > 0) {
      result.focus({ preventScroll: true });
      result.scrollIntoView({ block: "nearest" });
    } else {
      resultsToggleRef.current?.focus({ preventScroll: true });
    }
    selectionOriginRef.current = null;
  }, [selectedStore, isMapExpanded, isResultsExpanded, isDesktop]);

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
        setSelectedStore(null);
      } else {
        setLoadingMore(true);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

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

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "Cache-Control": "no-cache",
          },
        });

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
          setSelectedStore((current) =>
            reconcileSelectedStore(current, storeData),
          );
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
        if (!append) {
          setStores([]);
          setAllStores([]);
          setHasMore(false);
        }
        setSelectedStore(null);
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
            "가게 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
          setError(errorMessage);
          toast({
            title: "오류",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } finally {
        clearTimeout(timeoutId);
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

  // 초기 로드
  useEffect(() => {
    const loadInitialData = async () => {
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
      const radius = urlDistance ? parseFloat(urlDistance) : undefined;
      const minRating = urlRating ? parseFloat(urlRating) : undefined;
      const selectedCategories = urlCategories
        ? urlCategories.split(",")
        : undefined;
      const query = urlQuery || undefined;

      if (urlLat && urlLng) {
        // URL 파라미터에 위치 정보가 있으면 사용
        const lat = parseFloat(urlLat);
        const lng = parseFloat(urlLng);

        if (!isNaN(lat) && !isNaN(lng)) {
          setUserLocation({ lat, lng });
          setCurrentPage(1);
          setHasMore(false);

          await fetchStores(
            lat,
            lng,
            radius ?? 5,
            minRating,
            selectedCategories,
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
          if (radius !== undefined && radius !== 5) {
            filterDesc.push(`반경 ${radius}km`);
          }
          if (minRating && minRating > 0) {
            filterDesc.push(`평점 ${minRating}점 이상`);
          }
          if (selectedCategories && selectedCategories.length > 0) {
            filterDesc.push(`카테고리: ${selectedCategories.join(", ")}`);
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
        await fetchStores(
          savedLocation.lat,
          savedLocation.lng,
          radius ?? 5,
          minRating,
          selectedCategories,
          1,
          false,
          query,
        );

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
        await fetchStores(
          defaultLocation.lat,
          defaultLocation.lng,
          radius ?? 10,
          minRating,
          selectedCategories,
          1,
          false,
          query,
        );

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
  }, [searchParams, toast, fetchStores]);

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
    if (!isFilterOpen) {
      setFilterUsesSheet(isDesktop);
      if (document.activeElement instanceof HTMLElement) {
        filterTriggerRef.current = document.activeElement;
      }
    }
    setIsFilterOpen(!isFilterOpen);
  }, [isFilterOpen, isDesktop]);

  // 데스크톱 목록과 모바일 결과 패널에서 같은 상태와 페이지네이션 사용
  const ResultsContent = useMemo(() => {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-card">
        {loading ? (
          <StoreListSkeleton />
        ) : error ? (
          <div className="flex h-full items-center justify-center p-5">
            <div className="text-center">
              <p className="mb-4 text-sm text-destructive" role="alert">
                {error}
              </p>
              <Button
                onClick={() =>
                  fetchStores(userLocation?.lat, userLocation?.lng, 5)
                }
              >
                다시 시도
              </Button>
            </div>
          </div>
        ) : (
          <div className="pb-3">
            <MemoizedStoreList
              stores={stores}
              selectedStore={selectedStore}
              onStoreSelect={handleStoreSelect}
            />

            {/* 더보기 버튼 */}
            {hasMore && !loading && !error && (
              <div className="px-3 pt-3">
                <Button
                  onClick={loadMoreStores}
                  disabled={loadingMore}
                  variant="outline"
                  className="h-9 w-full rounded-sm bg-card text-xs"
                >
                  {loadingMore ? (
                    <>
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      로딩 중...
                    </>
                  ) : (
                    `가게 더 보기 (${stores.length}개 표시 중)`
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }, [
    loading,
    error,
    stores,
    selectedStore,
    handleStoreSelect,
    hasMore,
    loadingMore,
    loadMoreStores,
    fetchStores,
    userLocation,
  ]);

  // 뷰 모드별 컴포넌트 메모이제이션
  const MapView = useMemo(() => {
    return (
      <div className="w-full h-full">
        <KakaoMap
          key={
            userLocation
              ? `map-${userLocation.lat.toFixed(6)}-${userLocation.lng.toFixed(6)}`
              : "map-default"
          }
          stores={error ? [] : allStores}
          userLocation={userLocation}
          enableClustering={true}
          selectedStore={error ? null : selectedStore}
          onStoreSelect={handleStoreSelect}
          previewTitleRef={previewTitleRef}
          onLocationChange={() => {}} // 위치 변경 시 아무 작업 안함 (자동 검색 비활성화)
          onManualSearch={setCustomLocation} // 수동 검색 시 위치 업데이트 및 데이터 로드
          isVisible={true}
        />
      </div>
    );
  }, [
    error,
    allStores,
    userLocation,
    selectedStore,
    handleStoreSelect,
    setCustomLocation,
  ]);

  return (
    <ErrorBoundary fallback={<div className="p-4">오류가 발생했습니다.</div>}>
      <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <Header
          onSearch={handleSearch}
          onLocationRequest={handleGetCurrentLocation}
          onCustomLocationSet={setCustomLocation}
          userLocation={userLocation}
          onFilterToggle={handleFilterToggle}
          onApplyFilters={handleApplyFilters}
        />

        <div
          className="flex h-10 shrink-0 items-center overflow-x-auto border-b border-border bg-card px-3"
          role="group"
          aria-label="음식 종류"
        >
          <Button
            type="button"
            variant="ghost"
            className={`h-10 shrink-0 rounded-none border-b-2 px-3 text-xs ${
              activeCategories.length === 0
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-muted-foreground"
            }`}
            aria-pressed={activeCategories.length === 0}
            onClick={() => handleCategorySelect(null)}
          >
            전체
          </Button>
          {categories.map((category) => (
            <Button
              key={category}
              type="button"
              variant="ghost"
              className={`h-10 shrink-0 rounded-none border-b-2 px-3 text-xs ${
                activeCategories.includes(category)
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
              aria-pressed={activeCategories.includes(category)}
              onClick={() => handleCategorySelect(category)}
            >
              {category}
            </Button>
          ))}
        </div>

        {activeConditions.length > 0 && (
          <div
            className="flex shrink-0 items-center gap-3 overflow-x-auto border-b border-border bg-muted/30 px-4"
            aria-label="적용한 검색 조건"
          >
            <span className="shrink-0 text-xs text-muted-foreground">
              적용 중
            </span>
            {activeConditions.map((condition) => (
              <button
                key={condition.key}
                type="button"
                onClick={() => removeCondition(condition.key)}
                className="flex min-h-10 shrink-0 items-center gap-1.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                aria-label={`${condition.label} 해제`}
              >
                {condition.label}
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside
            className="hidden w-[380px] shrink-0 flex-col overflow-hidden border-r border-border bg-card lg:flex xl:w-[420px]"
            aria-label="주변 가게 검색 결과"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-4">
              <div className="min-w-0">
                <p className="mb-1 truncate text-xs text-muted-foreground">
                  {searchParams.get("searchLocation") || "설정한 지도 위치"}{" "}
                  주변
                </p>
                <h1 className="text-lg font-semibold tracking-tight">
                  무한리필 가게
                </h1>
                <p
                  className="mt-1 truncate text-xs text-muted-foreground"
                  role="status"
                >
                  {loading
                    ? "불러오는 중"
                    : error
                      ? "불러오기 실패"
                      : `${stores.length}개 표시`}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleFilterToggle}
                aria-label="검색 필터 열기"
                className="h-10 shrink-0 gap-2 rounded-sm px-3"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                필터
              </Button>
            </div>
            {ResultsContent}
          </aside>

          <div className="relative isolate min-w-0 flex-1">
            {/* 지도 크기는 결과 패널을 펼쳐도 유지해 지도 상태를 보존 */}
            <div
              className={`h-full ${isMapExpanded || isResultsExpanded ? "pb-[calc(4rem+env(safe-area-inset-bottom))]" : "pb-[calc(13rem+env(safe-area-inset-bottom))]"} lg:pb-0`}
            >
              {MapView}
            </div>

            {/* 배경과 지도 조작을 막지 않는 모바일 결과 패널 */}
            <section
              className={`absolute inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden ${
                isResultsExpanded
                  ? "h-[65%] max-h-[38rem]"
                  : isMapExpanded
                    ? "h-[calc(4rem+env(safe-area-inset-bottom))]"
                    : "h-[calc(13rem+env(safe-area-inset-bottom))] max-h-[55%]"
              }`}
              aria-label="모바일 가게 검색 결과"
              onKeyDown={(event) => {
                if (event.key === "Escape" && isResultsExpanded) {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsResultsExpanded(false);
                  resultsToggleRef.current?.focus();
                }
              }}
            >
              <div className="flex h-16 shrink-0 items-center justify-between gap-3 px-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold" role="status">
                    {loading
                      ? "가게 불러오는 중"
                      : error
                        ? "가게 불러오기 실패"
                        : `가게 ${stores.length}개 표시`}
                  </h2>
                  {hasMore && !loading && !error && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      목록에서 더 보기
                    </p>
                  )}
                </div>
                <div
                  className="flex shrink-0 items-center gap-1"
                  role="group"
                  aria-label="지도와 목록 보기"
                >
                  <Button
                    size="sm"
                    variant={
                      isMapExpanded && !isResultsExpanded ? "default" : "ghost"
                    }
                    className="h-9 gap-1.5 rounded-sm px-2.5"
                    aria-pressed={isMapExpanded && !isResultsExpanded}
                    onClick={() => {
                      setIsResultsExpanded(false);
                      setIsMapExpanded(true);
                    }}
                  >
                    <Map className="h-4 w-4" aria-hidden="true" />
                    지도
                  </Button>
                  <Button
                    ref={resultsToggleRef}
                    size="sm"
                    variant={isResultsExpanded ? "default" : "ghost"}
                    className="h-9 gap-1.5 rounded-sm px-2.5"
                    aria-expanded={isResultsExpanded}
                    aria-controls="mobile-store-results"
                    onClick={() => {
                      setIsResultsExpanded((expanded) => !expanded);
                      setIsMapExpanded(false);
                    }}
                  >
                    <List className="h-4 w-4" aria-hidden="true" />
                    {isResultsExpanded ? "목록 줄이기" : "목록 펼치기"}
                  </Button>
                </div>
              </div>
              <div
                ref={mobileResultsRef}
                id="mobile-store-results"
                className="min-h-0 flex-1 flex-col border-t border-border"
                hidden={isMapExpanded && !isResultsExpanded}
              >
                <div className="flex h-full min-h-0 flex-col">
                  {ResultsContent}
                </div>
              </div>
            </section>
          </div>
        </div>

        {filterUsesSheet ? (
          <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <SheetContent
              side="left"
              className="flex w-full flex-col gap-0 bg-card p-0 sm:max-w-[400px] motion-reduce:animate-none motion-reduce:transition-none data-[state=open]:duration-200 data-[state=closed]:duration-200"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                filterTriggerRef.current?.focus();
              }}
            >
              <SheetHeader className="shrink-0 border-b border-border p-4 pr-12 text-left">
                <SheetTitle className="text-base">검색 필터</SheetTitle>
                <SheetDescription className="text-xs">
                  음식 종류, 거리, 평점 조건을 설정합니다.
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1">
                <SearchFilters
                  showHeading={false}
                  userLocation={userLocation}
                  onApplyFilters={(filters) => {
                    handleApplyFilters(filters);
                    setIsFilterOpen(false);
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <Drawer
            open={isFilterOpen}
            onOpenChange={setIsFilterOpen}
            shouldScaleBackground={false}
            autoFocus
          >
            <DrawerContent
              className="h-[90dvh] max-h-[90dvh] overflow-hidden rounded-t-sm bg-card"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                filterTriggerRef.current?.focus();
              }}
            >
              <DrawerHeader className="shrink-0 border-b border-border p-4 pr-16 text-left">
                <DrawerTitle className="text-base">검색 필터</DrawerTitle>
                <DrawerDescription className="text-xs">
                  음식 종류, 거리, 평점 조건을 설정합니다.
                </DrawerDescription>
              </DrawerHeader>
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 top-6 h-9 w-9 rounded-sm"
                  aria-label="필터 닫기"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DrawerClose>
              <div className="min-h-0 flex-1">
                <SearchFilters
                  showHeading={false}
                  userLocation={userLocation}
                  onApplyFilters={(filters) => {
                    handleApplyFilters(filters);
                    setIsFilterOpen(false);
                  }}
                />
              </div>
            </DrawerContent>
          </Drawer>
        )}
      </main>
    </ErrorBoundary>
  );
}

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground"
          role="status"
        >
          지도 검색을 불러오는 중입니다.
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
