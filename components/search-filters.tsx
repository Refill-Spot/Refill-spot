"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";
import { useGeolocation } from "@/hooks/use-geolocation";
import { StoreFilters } from "@/hooks/use-stores";
import { useTranslation } from "@/hooks/use-translation";
import { filtersToURLParams } from "@/lib/api-utils";
import { useStoreStore } from "@/lib/store";
import {
  Beef,
  Coffee,
  Fish,
  MapPin,
  Pizza,
  Star,
  Utensils,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface SearchFiltersProps {
  onApplyFilters?: (filters: StoreFilters) => void;
  initialFilters?: StoreFilters;
  userLocation?: { lat: number; lng: number } | null;
}

export default function SearchFilters({
  onApplyFilters,
  initialFilters,
  userLocation,
}: SearchFiltersProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
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
  const [minRating, setMinRating] = useState(
    initialFilters?.minRating || storeFilters.minRating || 0,
  );
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
    const distanceParam = searchParams.get("distance") || searchParams.get("radius");
    const ratingParam = searchParams.get("rating") || searchParams.get("minRating");
    const queryParam = searchParams.get("q") || searchParams.get("query");

    let shouldUpdate = false;
    let newCategoryState = { ...categories };
    let newRadius = radius[0];
    let newMinRating = minRating;
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
      const hasSelectedCategories = Object.values(newCategoryState).some(val => val);
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

    // 평점 업데이트
    if (ratingParam) {
      const ratingValue = Number(ratingParam);
      if (!isNaN(ratingValue) && newMinRating !== ratingValue) {
        newMinRating = ratingValue;
        shouldUpdate = true;
      }
    } else if (newMinRating !== 0) {
      newMinRating = 0; // 기본값으로 리셋
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
      setMinRating(newMinRating);
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
        customSuccessMessage:
          t("location_filter_applied") || "위치 기반 필터가 적용되었습니다.",
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
      
      if (radius[0] !== 3) { // 기본값이 3이 아닐 때만 추가
        baseFilters.maxDistance = radius[0];
      }
      
      if (minRating > 0) {
        baseFilters.minRating = minRating;
      }
      
      if (searchQuery.trim()) {
        baseFilters.query = searchQuery.trim();
      }

      // 현재 위치 정보 추가
      if (userLocation) {
        baseFilters.latitude = userLocation.lat;
        baseFilters.longitude = userLocation.lng;
      }

      // 추가 필터 병합
      const finalFilters = { ...baseFilters, ...additionalFilters };

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
      
      const newUrl = params.toString() ? `${currentPath}?${params.toString()}` : currentPath;
      router.replace(newUrl);

      // 필터 적용 (상위 컴포넌트 콜백)
      if (onApplyFilters) {
        onApplyFilters(finalFilters);
      }
    },
    [
      categories,
      radius,
      minRating,
      searchQuery,
      userLocation,
      router,
      onApplyFilters,
      updateFilters,
    ],
  );

  const handleResetFilters = useCallback(() => {
    setRadius([3]);
    setMinRating(0);
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
    <div className="p-4 h-full bg-white">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[#333333]">{t("filter")}</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetFilters}
          className="text-[#2196F3] hover:text-[#1976d2] hover:bg-[#2196F3]/10"
        >
          {t("reset")}
        </Button>
      </div>

      <div className="space-y-6">
        {/* 검색어 필터 */}
        <div>
          <h3 className="font-medium mb-3 text-[#333333]">
            {t("search_keyword")}
          </h3>
          <div className="relative">
            <Input
              type="text"
              placeholder={t("search_placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
            {searchQuery && (
              <button
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                onClick={() => setSearchQuery("")}
                aria-label={t("clear")}
              >
                &times;
              </button>
            )}
          </div>
        </div>

        <Separator />

        {/* 현재 위치 버튼 */}
        <div>
          <Button
            onClick={handleCurrentLocation}
            variant="outline"
            className="w-full gap-2"
          >
            <MapPin className="h-4 w-4 text-[#2196F3]" />
            {t("use_current_location")}
          </Button>
        </div>

        <Separator />

        {/* 카테고리 필터 */}
        <div>
          <h3 className="font-medium mb-3 text-[#333333]">{t("category")}</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="meat"
                checked={categories.고기}
                onCheckedChange={() => handleCategoryChange("고기")}
              />
              <Label
                htmlFor="meat"
                className="flex items-center gap-2 cursor-pointer"
              >
                <Beef className="h-4 w-4 text-[#FF5722]" />
                <span>{t("meat")}</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="seafood"
                checked={categories.해산물}
                onCheckedChange={() => handleCategoryChange("해산물")}
              />
              <Label
                htmlFor="seafood"
                className="flex items-center gap-2 cursor-pointer"
              >
                <Fish className="h-4 w-4 text-[#2196F3]" />
                <span>{t("seafood")}</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="western"
                checked={categories.양식}
                onCheckedChange={() => handleCategoryChange("양식")}
              />
              <Label
                htmlFor="western"
                className="flex items-center gap-2 cursor-pointer"
              >
                <Pizza className="h-4 w-4 text-[#FFC107]" />
                <span>{t("western")}</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="korean"
                checked={categories.한식}
                onCheckedChange={() => handleCategoryChange("한식")}
              />
              <Label
                htmlFor="korean"
                className="flex items-center gap-2 cursor-pointer"
              >
                <Utensils className="h-4 w-4 text-[#4CAF50]" />
                <span>{t("korean")}</span>
              </Label>
            </div>
            {/* 추가 카테고리 */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="chinese"
                checked={categories.중식}
                onCheckedChange={() => handleCategoryChange("중식")}
              />
              <Label
                htmlFor="chinese"
                className="flex items-center gap-2 cursor-pointer"
              >
                <Utensils className="h-4 w-4 text-[#F44336]" />
                <span>{t("chinese")}</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="japanese"
                checked={categories.일식}
                onCheckedChange={() => handleCategoryChange("일식")}
              />
              <Label
                htmlFor="japanese"
                className="flex items-center gap-2 cursor-pointer"
              >
                <Utensils className="h-4 w-4 text-[#9C27B0]" />
                <span>{t("japanese")}</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="cafe"
                checked={categories.카페}
                onCheckedChange={() => handleCategoryChange("카페")}
              />
              <Label
                htmlFor="cafe"
                className="flex items-center gap-2 cursor-pointer"
              >
                <Coffee className="h-4 w-4 text-[#795548]" />
                <span>{t("cafe")}</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="dessert"
                checked={categories.디저트}
                onCheckedChange={() => handleCategoryChange("디저트")}
              />
              <Label
                htmlFor="dessert"
                className="flex items-center gap-2 cursor-pointer"
              >
                <Coffee className="h-4 w-4 text-[#E91E63]" />
                <span>{t("dessert")}</span>
              </Label>
            </div>
          </div>
        </div>

        <Separator />

        {/* 반경 필터 */}
        <div>
          <div className="flex justify-between mb-3">
            <h3 className="font-medium text-[#333333]">{t("radius")}</h3>
            <span className="text-sm font-medium">{radius[0]}km</span>
          </div>
          <Slider
            defaultValue={[3]}
            max={5}
            min={1}
            step={1}
            value={radius}
            onValueChange={setRadius}
            className="py-2"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1km</span>
            <span>3km</span>
            <span>5km</span>
          </div>
        </div>

        <Separator />

        {/* 평점 필터 */}
        <div>
          <h3 className="font-medium mb-3 text-[#333333]">{t("min_rating")}</h3>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                className={`p-1 rounded-md transition-colors ${
                  minRating >= rating ? "text-[#FFA726]" : "text-gray-300"
                }`}
                onClick={() => setMinRating(rating)}
              >
                <Star className="h-5 w-5 fill-current" />
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={() => handleApplyFilters()}
          className="w-full bg-[#FF5722] hover:bg-[#E64A19] mt-4"
        >
          {t("apply_filter")}
        </Button>
      </div>
    </div>
  );
}
