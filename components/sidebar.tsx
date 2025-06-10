"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { useTranslation } from "@/hooks/use-translation";
import {
  Beef,
  Coffee,
  Fish,
  Info,
  MessageCircle,
  Pizza,
  Soup,
  Star,
  Utensils,
} from "lucide-react";
import Link from "next/link";
import React, { memo, useCallback, useState } from "react";

// 필터 타입 정의
interface FilterOptions {
  categories?: string[];
  maxDistance?: number;
  minRating?: number;
  latitude?: number;
  longitude?: number;
}

// Sidebar 컴포넌트의 props 타입 정의
interface SidebarProps {
  onApplyFilters: (filters: FilterOptions) => void;
  userLocation?: { lat: number; lng: number } | null;
}

// 메모이제이션된 카테고리 체크박스 컴포넌트
const CategoryCheckbox = memo(
  ({
    id,
    checked,
    onChange,
    icon,
    label,
  }: {
    id: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    icon: React.ReactNode;
    label: string;
  }) => {
    return (
      <div className="flex items-center space-x-2">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(checked) => {
            if (typeof checked === "boolean") {
              onChange(checked);
            }
          }}
        />
        <Label htmlFor={id} className="flex items-center gap-2 cursor-pointer">
          {icon}
          <span>{label}</span>
        </Label>
      </div>
    );
  }
);

CategoryCheckbox.displayName = "CategoryCheckbox";

function Sidebar({ onApplyFilters, userLocation }: SidebarProps) {
  const { t } = useTranslation();
  const [radius, setRadius] = useState([3]);
  const [minRating, setMinRating] = useState(0);
  const [categories, setCategories] = useState({
    고기: false,
    해산물: false,
    양식: false,
    한식: false,
    중식: false,
    일식: false,
    디저트: false,
  });

  // useCallback으로 함수 메모이제이션
  const handleCategoryChange = useCallback(
    (category: string, checked: boolean) => {
      setCategories((prev) => ({
        ...prev,
        [category]: checked,
      }));
    },
    []
  );

  const handleApplyFilters = useCallback(() => {
    const selectedCategories = Object.entries(categories)
      .filter(([_, isSelected]) => isSelected)
      .map(([category]) => category);

    // 현재 사용자 위치가 있으면 사용, 없으면 GPS 요청
    if (userLocation) {
      // 기존 사용자 위치 사용
      onApplyFilters({
        categories: selectedCategories,
        maxDistance: radius[0],
        minRating: minRating,
        latitude: userLocation.lat,
        longitude: userLocation.lng,
      });
    } else {
      // GPS로 현재 위치 가져오기
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;

          // 필터 적용
          onApplyFilters({
            categories: selectedCategories,
            maxDistance: radius[0],
            minRating: minRating,
            latitude,
            longitude,
          });
        },
        (error) => {
          console.error("위치 정보를 가져올 수 없습니다:", error);

          // 위치 정보 없이 필터 적용
          onApplyFilters({
            categories: selectedCategories,
            maxDistance: radius[0],
            minRating: minRating,
          });
        }
      );
    }
  }, [categories, radius, minRating, onApplyFilters, userLocation]);

  const handleResetFilters = useCallback(() => {
    setRadius([3]);
    setMinRating(0);
    setCategories({
      고기: false,
      해산물: false,
      양식: false,
      한식: false,
      중식: false,
      일식: false,
      디저트: false,
    });

    onApplyFilters({
      categories: [],
      maxDistance: 5,
      minRating: 0,
    });
  }, [onApplyFilters]);

  // 카테고리 체크박스 변경 핸들러
  const handleMeatChange = useCallback(
    (checked: boolean) => {
      handleCategoryChange("고기", checked);
    },
    [handleCategoryChange]
  );

  const handleSeafoodChange = useCallback(
    (checked: boolean) => {
      handleCategoryChange("해산물", checked);
    },
    [handleCategoryChange]
  );

  const handleWesternChange = useCallback(
    (checked: boolean) => {
      handleCategoryChange("양식", checked);
    },
    [handleCategoryChange]
  );

  const handleKoreanChange = useCallback(
    (checked: boolean) => {
      handleCategoryChange("한식", checked);
    },
    [handleCategoryChange]
  );

  const handleChineseChange = useCallback(
    (checked: boolean) => {
      handleCategoryChange("중식", checked);
    },
    [handleCategoryChange]
  );

  const handleJapaneseChange = useCallback(
    (checked: boolean) => {
      handleCategoryChange("일식", checked);
    },
    [handleCategoryChange]
  );

  const handleDessertChange = useCallback(
    (checked: boolean) => {
      handleCategoryChange("디저트", checked);
    },
    [handleCategoryChange]
  );

  return (
    <div className="p-4 h-full bg-white">
      {/* 네비게이션 섹션 */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-[#333333] mb-3">메뉴</h2>
        <div className="space-y-2">
          <Link href="/onboarding">
            <Button variant="ghost" className="w-full justify-start text-left">
              <Info className="h-4 w-4 mr-2 text-[#2196F3]" />
              서비스 소개
            </Button>
          </Link>
          <Link href="/contact">
            <Button variant="ghost" className="w-full justify-start text-left">
              <MessageCircle className="h-4 w-4 mr-2 text-[#4CAF50]" />
              문의하기
            </Button>
          </Link>
        </div>
      </div>

      <Separator className="mb-6" />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[#333333]">필터</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetFilters}
          className="text-[#2196F3] hover:text-[#1976d2] hover:bg-[#2196F3]/10"
        >
          초기화
        </Button>
      </div>

      <div className="space-y-6">
        {/* Category filter */}
        <div>
          <h3 className="font-medium mb-3 text-[#333333]">카테고리</h3>
          <div className="space-y-2">
            <CategoryCheckbox
              id="meat"
              checked={categories.고기}
              onChange={handleMeatChange}
              icon={<Beef className="h-4 w-4 text-[#FF5722]" />}
              label={t("meat")}
            />
            <CategoryCheckbox
              id="seafood"
              checked={categories.해산물}
              onChange={handleSeafoodChange}
              icon={<Fish className="h-4 w-4 text-[#2196F3]" />}
              label={t("seafood")}
            />
            <CategoryCheckbox
              id="western"
              checked={categories.양식}
              onChange={handleWesternChange}
              icon={<Pizza className="h-4 w-4 text-[#FFC107]" />}
              label={t("western")}
            />
            <CategoryCheckbox
              id="korean"
              checked={categories.한식}
              onChange={handleKoreanChange}
              icon={<Utensils className="h-4 w-4 text-[#4CAF50]" />}
              label={t("korean")}
            />
            <CategoryCheckbox
              id="chinese"
              checked={categories.중식}
              onChange={handleChineseChange}
              icon={<Soup className="h-4 w-4 text-[#FF9800]" />}
              label={t("chinese")}
            />
            <CategoryCheckbox
              id="japanese"
              checked={categories.일식}
              onChange={handleJapaneseChange}
              icon={<Fish className="h-4 w-4 text-[#E91E63]" />}
              label={t("japanese")}
            />
            <CategoryCheckbox
              id="dessert"
              checked={categories.디저트}
              onChange={handleDessertChange}
              icon={<Coffee className="h-4 w-4 text-[#795548]" />}
              label={t("dessert")}
            />
          </div>
        </div>

        <Separator />

        {/* Radius filter */}
        <div>
          <div className="flex justify-between mb-3">
            <h3 className="font-medium text-[#333333]">반경 설정</h3>
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

        {/* Rating filter */}
        <div>
          <h3 className="font-medium mb-3 text-[#333333]">최소 평점</h3>
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
          onClick={handleApplyFilters}
          className="w-full bg-[#FF5722] hover:bg-[#E64A19] mt-4"
        >
          필터 적용
        </Button>
      </div>
    </div>
  );
}

export default memo(Sidebar);
