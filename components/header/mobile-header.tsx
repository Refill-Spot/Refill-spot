"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Filter, MapPin, Menu, Search, Info, MessageCircle, Bell } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LocationDialog } from "./location-dialog";
import { SearchInput } from "./search-input";

interface MobileHeaderProps {
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

export function MobileHeader({
  onMenuClick,
  onFilterClick,
  onCustomLocationSet,
  currentLocationInfo,
  isLocationDialogOpen,
  onLocationDialogOpen,
  onLocationDialogClose,
  onPlaceSelect,
  onManualSearch,
}: MobileHeaderProps) {
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);

  return (
    <>
      {/* 모바일 헤더 - 첫 번째 줄 */}
      <div className="lg:hidden flex items-center justify-between w-full">
        <div className="flex items-center space-x-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/onboarding" className="flex items-center w-full">
                  <Info className="h-4 w-4 mr-2 text-[#2196F3]" />
                  서비스 소개
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
            <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-lg p-1.5">
              <svg
                className="w-5 h-5 text-white"
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
              <h1 className="text-lg font-bold text-gray-900">Refill-spot</h1>
              <p className="text-xs text-gray-500 hidden sm:block">
                무한리필 가게 찾기
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center space-x-3">
          {/* 필터 버튼 */}
          <Button variant="ghost" size="sm" onClick={onFilterClick}>
            <Filter className="h-5 w-5 text-[#FF5722]" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSearchDialogOpen(true)}
          >
            <Search className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* 모바일 헤더 - 두 번째 줄 (위치 정보) */}
      <div className="lg:hidden flex items-center justify-center mt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onLocationDialogOpen}
          className="flex items-center space-x-2 text-xs"
        >
          <MapPin className="h-4 w-4 text-[#2196F3]" />
          <span className="truncate max-w-48">
            {currentLocationInfo
              ? `${currentLocationInfo.address} (${currentLocationInfo.distance}km)`
              : "위치 설정"}
          </span>
        </Button>
      </div>

      {/* 모바일 검색 다이얼로그 */}
      <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Search className="h-5 w-5" />
              <span>가게 검색</span>
            </DialogTitle>
            <DialogDescription>
              지역이나 주소를 입력하여 주변 무한리필 가게를 검색하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <SearchInput
              onPlaceSelect={(place) => {
                onPlaceSelect?.(place);
                setIsSearchDialogOpen(false);
              }}
              onManualSearch={(searchText) => {
                onManualSearch?.(searchText);
                setIsSearchDialogOpen(false);
              }}
              placeholder="지역, 주소를 입력하세요"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* 위치 설정 다이얼로그 */}
      <LocationDialog
        isOpen={isLocationDialogOpen}
        onClose={onLocationDialogClose}
        onCustomLocationSet={onCustomLocationSet}
      />
    </>
  );
}
