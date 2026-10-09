"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { useGeolocation } from "@/hooks/use-geolocation";
import { StoreFilters } from "@/hooks/use-stores";
import { filtersToURLParams } from "@/lib/api-utils";
import { useStoreStore } from "@/lib/store";
import ko from "@/public/locales/ko.json";
import { Loader2, MapPin, Star } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";

interface SearchFiltersProps {
  onApplyFilters?: (filters: StoreFilters) => void;
  initialFilters?: StoreFilters;
  userLocation?: { lat: number; lng: number } | null;
  showHeading?: boolean;
}

export default function SearchFilters({
  onApplyFilters,
  initialFilters,
  userLocation,
  showHeading = true,
}: SearchFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterId = useId();
  const {
    filters: storeFilters,
    updateFilters,
    resetFilters: resetStoreFilters,
  } = useStoreStore();
  const geolocation = useGeolocation();

  // 필터 상태 관리
  const [radius, setRadius] = useState([
    initialFilters?.maxDistance || storeFilters.maxDistance || 3,
  ]);
  const [searchQuery, setSearchQuery] = useState(
    initialFilters?.query || storeFilters.query || "",
  );
  const [categories, setCategories] = useState<Record<string, boolean>>({
    고기:
      initialFilters?.categories?.includes("고기") ||
      storeFilters.categories?.includes("고기") ||
      false,
    해산물:
      initialFilters?.categories?.includes("해산물") ||
      storeFilters.categories?.includes("해산물") ||
      false,
    양식:
      initialFilters?.categories?.includes("양식") ||
      storeFilters.categories?.includes("양식") ||
      false,
    한식:
      initialFilters?.categories?.includes("한식") ||
      storeFilters.categories?.includes("한식") ||
      false,
    중식:
      initialFilters?.categories?.includes("중식") ||
      storeFilters.categories?.includes("중식") ||
      false,
    일식:
      initialFilters?.categories?.includes("일식") ||
      storeFilters.categories?.includes("일식") ||
      false,
    카페:
      initialFilters?.categories?.includes("카페") ||
      storeFilters.categories?.includes("카페") ||
      false,
    디저트:
      initialFilters?.categories?.includes("디저트") ||
      storeFilters.categories?.includes("디저트") ||
      false,
  });

  // URL 파라미터에서 필터 설정 가져오기
  useEffect(() => {
    const categoryParam = searchParams.get("categories");
    const distanceParam =
      searchParams.get("distance") || searchParams.get("radius");
    const queryParam = searchParams.get("q") || searchParams.get("query");

    let shouldUpdate = false;
    let newCategoryState = { ...categories };
    let newRadius = radius[0];
    let newSearchQuery = searchQuery;

    // 카테고리 업데이트
    if (categoryParam) {
      const categoryList = categoryParam.split(",");

      Object.keys(newCategoryState).forEach((key) => {
        const shouldCheck = categoryList.includes(key);
        if (newCategoryState[key] !== shouldCheck) {
          newCategoryState[key] = shouldCheck;
          shouldUpdate = true;
        }
      });
    } else {
      // 카테고리 파라미터가 없으면 모든 카테고리 해제
      const hasSelectedCategories = Object.values(newCategoryState).some(
        (val) => val,
      );
      if (hasSelectedCategories) {
        newCategoryState = {
          고기: false,
          해산물: false,
          양식: false,
          한식: false,
          중식: false,
          일식: false,
          카페: false,
          디저트: false,
        };
        shouldUpdate = true;
      }
    }

    // 거리 업데이트
    if (distanceParam) {
      const distanceValue = Number(distanceParam);
      if (!isNaN(distanceValue) && newRadius !== distanceValue) {
        newRadius = distanceValue;
        shouldUpdate = true;
      }
    } else if (newRadius !== 3) {
      newRadius = 3; // 기본값으로 리셋
      shouldUpdate = true;
    }

    // 검색어 업데이트
    if (queryParam && newSearchQuery !== queryParam) {
      newSearchQuery = queryParam;
      shouldUpdate = true;
    } else if (!queryParam && newSearchQuery !== "") {
      newSearchQuery = ""; // 기본값으로 리셋
      shouldUpdate = true;
    }

    // 상태 업데이트
    if (shouldUpdate) {
      setCategories(newCategoryState);
      setRadius([newRadius]);
      setSearchQuery(newSearchQuery);
    }
  }, [searchParams]);

  const handleCategoryChange = (category: string) => {
    setCategories({
      ...categories,
      [category]: !categories[category],
    });
  };

  const handleCurrentLocation = async () => {
    try {
      const coordinates = await geolocation.getCurrentPosition({
        showToast: true,
        customSuccessMessage: ko.location_filter_applied,
      });

      // 위치 정보를 필터에 포함시켜 적용
      handleApplyFilters({
        latitude: coordinates.lat,
        longitude: coordinates.lng,
      });
    } catch (error) {
      console.error("위치 정보 오류:", error);
      // 에러는 useGeolocation 훅에서 이미 처리됨
    }
  };

  const handleApplyFilters = useCallback(
    (additionalFilters?: Partial<StoreFilters>) => {
      const selectedCategories = Object.entries(categories)
        .filter(([_, isSelected]) => isSelected)
        .map(([category]) => category);

      // 기본 필터 생성
      const baseFilters: StoreFilters = {};

      if (selectedCategories.length > 0) {
        baseFilters.categories = selectedCategories;
      }

      if (radius[0] !== 3) {
        // 기본값이 3이 아닐 때만 추가
        baseFilters.maxDistance = radius[0];
      }

      if (searchQuery.trim()) {
        baseFilters.query = searchQuery.trim();
      }

      // 현재 위치 정보 추가
      if (userLocation) {
        baseFilters.latitude = userLocation.lat;
        baseFilters.longitude = userLocation.lng;
      }

      // 추가 필터 병합 및 글로벌 스토어의 기존 평점 조건 해제
      const finalFilters = {
        ...baseFilters,
        ...additionalFilters,
        minRating: 0,
      };

      // 글로벌 스토어 업데이트
      updateFilters(finalFilters);

      // URL 업데이트
      const params = filtersToURLParams(finalFilters);
      const currentPath = window.location.pathname;
      const currentParams = new URLSearchParams(window.location.search);

      // 위치 정보는 URL에서 유지
      const lat = currentParams.get("lat");
      const lng = currentParams.get("lng");
      if (lat && lng) {
        params.set("lat", lat);
        params.set("lng", lng);
      }

      const newUrl = params.toString()
        ? `${currentPath}?${params.toString()}`
        : currentPath;
      router.replace(newUrl);

      // 필터 적용 (상위 컴포넌트 콜백)
      if (onApplyFilters) {
        onApplyFilters(finalFilters);
      }
    },
    [
      categories,
      radius,
      searchQuery,
      userLocation,
      router,
      onApplyFilters,
      updateFilters,
    ],
  );

  const handleResetFilters = useCallback(() => {
    setRadius([3]);
    setSearchQuery("");
    setCategories({
      고기: false,
      해산물: false,
      양식: false,
      한식: false,
      중식: false,
      일식: false,
      카페: false,
      디저트: false,
    });

    // 글로벌 스토어 초기화
    resetStoreFilters();

    // 필터 적용 (상위 컴포넌트 콜백)
    if (onApplyFilters) {
      onApplyFilters({});
    }

    // URL 초기화 (파라미터만 제거, 위치 정보는 유지)
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const currentPath = window.location.pathname;

    if (lat && lng) {
      router.replace(`${currentPath}?lat=${lat}&lng=${lng}`);
    } else {
      router.replace(currentPath);
    }
  }, [router, searchParams, onApplyFilters, resetStoreFilters]);

  return (
    <form
      className="flex h-full min-h-0 flex-col bg-card text-foreground"
      data-vaul-no-drag=""
      onSubmit={(event) => {
        event.preventDefault();
        handleApplyFilters();
      }}
    >
      {showHeading && (
        <div className="shrink-0 border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">{ko.filter}</h2>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5">
        {/* 검색어 필터 */}
        <div>
          <Label
            htmlFor={`${filterId}-query`}
            className="mb-2 block text-sm font-semibold"
          >
            {ko.search_keyword}
          </Label>
          <div className="relative">
            <Input
              id={`${filterId}-query`}
              type="text"
              placeholder={ko.search_placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 bg-background pr-11"
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setSearchQuery("")}
                aria-label={ko.clear}
              >
                &times;
              </button>
            )}
          </div>
        </div>

        <Separator />

        {/* 카테고리 필터 */}
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{ko.category}</legend>
          <div className="grid grid-cols-2 gap-x-4">
            {[
              { value: "고기", label: "meat" },
              { value: "해산물", label: "seafood" },
              { value: "양식", label: "western" },
              { value: "한식", label: "korean" },
              { value: "중식", label: "chinese" },
              { value: "일식", label: "japanese" },
              { value: "카페", label: "cafe" },
              { value: "디저트", label: "dessert" },
            ].map(({ value, label }) => (
              <div key={value} className="flex items-center gap-2">
                <Checkbox
                  id={`${filterId}-${label}`}
                  checked={categories[value]}
                  onCheckedChange={() => handleCategoryChange(value)}
                />
                <Label
                  htmlFor={`${filterId}-${label}`}
                  className={`flex min-h-11 flex-1 cursor-pointer items-center ${categories[value] ? "font-semibold text-foreground" : "font-normal"}`}
                >
                  {value}
                </Label>
              </div>
            ))}
          </div>
        </fieldset>

        <Separator />

        {/* 반경 필터 */}
        <div role="group" aria-labelledby={`${filterId}-radius`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 id={`${filterId}-radius`} className="text-sm font-semibold">
              {ko.radius}
            </h3>
            <span className="text-sm font-semibold tabular-nums">
              {radius[0]}km
            </span>
          </div>
          <Slider
            aria-labelledby={`${filterId}-radius`}
            aria-valuetext={`${radius[0]}km`}
            defaultValue={[3]}
            max={5}
            min={1}
            step={1}
            value={radius}
            onValueChange={setRadius}
            className="py-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>1km</span>
            <span>3km</span>
            <span>5km</span>
          </div>
          <Button
            type="button"
            onClick={handleCurrentLocation}
            variant="outline"
            disabled={geolocation.isLoading}
            aria-busy={geolocation.isLoading}
            className="mt-4 h-11 w-full gap-2 bg-background"
          >
            {geolocation.isLoading ? (
              <Loader2
                className="h-4 w-4 motion-safe:animate-spin"
                aria-hidden="true"
              />
            ) : (
              <MapPin className="h-4 w-4" aria-hidden="true" />
            )}
            {ko.use_current_location}
          </Button>
        </div>

        <Separator />

        {/* 평점 필터 */}
        <fieldset disabled aria-describedby={`${filterId}-rating-unavailable`}>
          <legend className="mb-2 text-sm font-semibold">
            {ko.min_rating}
          </legend>
          <p
            id={`${filterId}-rating-unavailable`}
            className="mb-2 text-xs text-muted-foreground"
          >
            외부 평점 검증 전에는 평점 필터를 사용할 수 없습니다.
          </p>
          <div className="grid grid-cols-2 gap-x-4">
            {[0, 1, 2, 3, 4, 5].map((rating) => (
              <Label
                key={rating}
                htmlFor={`${filterId}-rating-${rating}`}
                className={`flex min-h-11 cursor-not-allowed items-center gap-2 text-muted-foreground ${rating === 0 ? "font-semibold" : "font-normal"}`}
              >
                <input
                  id={`${filterId}-rating-${rating}`}
                  type="radio"
                  name={`${filterId}-rating`}
                  value={rating}
                  checked={rating === 0}
                  readOnly
                  aria-label={rating === 0 ? ko.all_stores : `${rating}점 이상`}
                  className="h-4 w-4 shrink-0 accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                />
                {rating === 0 ? (
                  ko.all_stores
                ) : (
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Star
                      className="h-3.5 w-3.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    {rating}점 이상
                  </span>
                )}
              </Label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex shrink-0 gap-3 border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          variant="outline"
          onClick={handleResetFilters}
          className="h-11 bg-background"
        >
          {ko.reset}
        </Button>
        <Button type="submit" className="h-11 flex-1">
          {ko.apply_filter}
        </Button>
      </div>
    </form>
  );
}
