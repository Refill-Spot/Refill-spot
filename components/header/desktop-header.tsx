"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Filter, MapPin, Menu, Info, MessageCircle, Bell, Map } from "lucide-react";
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
      <div className="flex items-center justify-between w-full">
        {/* 로고 및 메뉴 */}
        <div className="flex items-center space-x-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/map" className="flex items-center w-full">
                  <Map className="h-4 w-4 mr-2 text-[#FF5722]" />
                  맛집 찾기
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/guide" className="flex items-center w-full">
                  <Info className="h-4 w-4 mr-2 text-[#2196F3]" />
                  이용 가이드
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/announcements" className="flex items-center w-full">
                  <Bell className="h-4 w-4 mr-2 text-[#FF9800]" />
                  공지사항
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/contact" className="flex items-center w-full">
                  <MessageCircle className="h-4 w-4 mr-2 text-[#4CAF50]" />
                  문의하기
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Link href="/" className="flex items-center space-x-2">
            <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-lg p-2">
              <svg
                className="w-6 h-6 text-white"
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
            <div>
              <h1 className="text-xl font-bold text-gray-900">Refill-spot</h1>
              <p className="text-xs text-gray-500">무한리필 가게 찾기</p>
            </div>
          </Link>
        </div>

        {/* 검색 영역 */}
        <div className="flex-1 max-w-2xl mx-8 flex items-center space-x-6">
          {/* 필터 버튼 */}
          <Button variant="outline" size="sm" onClick={onFilterClick}>
            <Filter className="h-4 w-4 text-[#FF5722]" />
            <span className="hidden xl:inline ml-2">필터</span>
          </Button>
          
          <div className="flex-1 mx-4">
            <SearchInput
              onPlaceSelect={onPlaceSelect}
              onManualSearch={onManualSearch}
              placeholder="지역, 주소를 입력하세요"
            />
          </div>
          
          {/* 현재 위치 정보 */}
          <Button
            variant="outline"
            size="sm"
            onClick={onLocationDialogOpen}
            className="flex items-center space-x-2"
          >
            <MapPin className="h-4 w-4 text-[#2196F3]" />
            <span className="hidden xl:inline">
              {currentLocationInfo
                ? `${currentLocationInfo.address} (${currentLocationInfo.distance}km)`
                : "위치 설정"}
            </span>
            <span className="xl:hidden">위치</span>
          </Button>
        </div>

        {/* 우측 버튼들 */}
        <div className="flex items-center space-x-2 mr-3">
          <Button asChild className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white">
            <Link href="/map" className="flex items-center">
              <Map className="h-4 w-4 mr-2" />
              맛집 찾기
            </Link>
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
