"use client";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LocationResult } from "@/lib/location-search";
import { Bell, Filter, Info, MapPin, Menu, MessageCircle } from "lucide-react";
import Link from "next/link";
import { LocationDialog } from "./location-dialog";
import { SearchInput } from "./search-input";

interface DesktopHeaderProps {
  onMenuClick: () => void;
  onFilterClick: () => void;
  onCustomLocationSet?: (lat: number, lng: number, radius: number) => void;
  currentLocationInfo?: { address: string; distance: number } | null;
  isLocationDialogOpen: boolean;
  onLocationDialogOpen: () => void;
  onLocationDialogClose: () => void;
  onPlaceSelect?: (place: LocationResult) => void;
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
}: DesktopHeaderProps) {
  return (
    <>
      <div className="flex w-full min-w-0 items-center gap-6 xl:gap-10">
        <Link
          href="/"
          aria-label="Refill Spot 홈"
          className="flex h-12 shrink-0 items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
        >
          <BrandMark size={38} className="shrink-0" />
          <span className="flex flex-col gap-0.5">
            <span className="text-[19px] font-semibold leading-6 tracking-tight text-foreground">
              Refill Spot
            </span>
            <span className="text-[11px] leading-4 text-muted-foreground">
              무한리필 식당 안내
            </span>
          </span>
        </Link>

        <div className="mx-auto min-w-0 max-w-2xl flex-1">
          <SearchInput
            onPlaceSelect={onPlaceSelect}
            placeholder="지역, 역 이름, 가게 이름 검색"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1 border-l border-border pl-3">
          <Button
            variant="ghost"
            onClick={onFilterClick}
            aria-label="검색 필터 열기"
            className="h-11 gap-2 px-3 text-muted-foreground hover:text-foreground"
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
            필터
          </Button>
          <Button
            variant="ghost"
            onClick={onLocationDialogOpen}
            aria-label={
              currentLocationInfo
                ? `검색 위치 변경: ${currentLocationInfo.address}, 반경 ${currentLocationInfo.distance}km`
                : "검색 위치 설정"
            }
            className="h-11 min-w-0 max-w-40 gap-2 px-3 text-muted-foreground hover:text-foreground"
          >
            <MapPin className="h-4 w-4" aria-hidden="true" />
            <span className="hidden min-w-0 truncate xl:inline">
              {currentLocationInfo
                ? `${currentLocationInfo.address} (${currentLocationInfo.distance}km)`
                : "위치 설정"}
            </span>
            <span className="xl:hidden">위치</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="메뉴 열기"
                onClick={onMenuClick}
                className="h-11 w-11 text-muted-foreground hover:text-foreground"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/guide" className="flex w-full items-center">
                  <Info className="mr-2 h-4 w-4" aria-hidden="true" />
                  이용 가이드
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href="/announcements"
                  className="flex w-full items-center"
                >
                  <Bell className="mr-2 h-4 w-4" aria-hidden="true" />
                  공지사항
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/contact" className="flex w-full items-center">
                  <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                  문의하기
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <LocationDialog
        isOpen={isLocationDialogOpen}
        onClose={onLocationDialogClose}
        onCustomLocationSet={onCustomLocationSet}
      />
    </>
  );
}
