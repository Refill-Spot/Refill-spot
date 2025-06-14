"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Filter, MapPin, Menu, Search } from "lucide-react";
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
          <Button variant="ghost" size="sm" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
          </Button>
          <Link href="/" className="flex items-center space-x-2">
            <div className="bg-blue-600 rounded-lg p-1.5">
              <div className="w-5 h-5 bg-white rounded-sm flex items-center justify-center">
                <span className="text-blue-600 font-bold text-xs">R</span>
              </div>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">리필스팟</h1>
              <p className="text-xs text-gray-500 hidden sm:block">
                제로웨이스트 가게 찾기
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSearchDialogOpen(true)}
          >
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onFilterClick}>
            <Filter className="h-5 w-5" />
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
          <MapPin className="h-4 w-4" />
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
