"use client";

import { Button } from "@/components/ui/button";
import { Filter, MapPin, Menu } from "lucide-react";
import Link from "next/link";
import { LocationDialog } from "./location-dialog";
import { SearchInput } from "./search-input";

interface DesktopHeaderProps {
  onMenuClick: () => void;
  onFilterClick: () => void;
  onCustomLocationSet?: (lat: number, lng: number, radius: number) => void;
  currentLocationInfo?: {
    address: string;
    distance: number;
  } | null;
  isLocationDialogOpen: boolean;
  onLocationDialogOpen: () => void;
  onLocationDialogClose: () => void;
  onPlaceSelect?: (place: any) => void;
  onManualSearch?: (searchText: string) => void;
}

export function DesktopHeader({
  onMenuClick,
  onFilterClick,
  onCustomLocationSet,
  currentLocationInfo,
  isLocationDialogOpen,
  onLocationDialogOpen,
  onLocationDialogClose,
  onPlaceSelect,
  onManualSearch,
}: DesktopHeaderProps) {
  return (
    <>
      <div className="hidden lg:flex items-center justify-between w-full">
        {/* 로고 및 메뉴 */}
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
          </Button>
          <Link href="/" className="flex items-center space-x-2">
            <div className="bg-blue-600 rounded-lg p-2">
              <div className="w-6 h-6 bg-white rounded-sm flex items-center justify-center">
                <span className="text-blue-600 font-bold text-sm">R</span>
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">리필스팟</h1>
              <p className="text-xs text-gray-500">제로웨이스트 가게 찾기</p>
            </div>
          </Link>
        </div>

        {/* 검색 영역 */}
        <div className="flex-1 max-w-2xl mx-8">
          <SearchInput
            onPlaceSelect={onPlaceSelect}
            onManualSearch={onManualSearch}
            placeholder="지역, 주소를 입력하세요"
          />
        </div>

        {/* 우측 컨트롤 */}
        <div className="flex items-center space-x-3">
          {/* 현재 위치 정보 */}
          <Button
            variant="outline"
            size="sm"
            onClick={onLocationDialogOpen}
            className="flex items-center space-x-2"
          >
            <MapPin className="h-4 w-4" />
            <span className="hidden xl:inline">
              {currentLocationInfo
                ? `${currentLocationInfo.address} (${currentLocationInfo.distance}km)`
                : "위치 설정"}
            </span>
            <span className="xl:hidden">위치</span>
          </Button>

          {/* 필터 버튼 */}
          <Button variant="outline" size="sm" onClick={onFilterClick}>
            <Filter className="h-4 w-4" />
            <span className="hidden xl:inline ml-2">필터</span>
          </Button>
        </div>
      </div>

      {/* 위치 설정 다이얼로그 */}
      <LocationDialog
        isOpen={isLocationDialogOpen}
        onClose={onLocationDialogClose}
        onCustomLocationSet={onCustomLocationSet}
      />
    </>
  );
}
