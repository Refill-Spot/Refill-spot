"use client";

import { BrandMark } from "@/components/brand-mark";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LocationResult } from "@/lib/location-search";
import {
  Bell,
  Filter,
  Info,
  Map,
  MapPin,
  Menu,
  MessageCircle,
  Search,
} from "lucide-react";
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
  onPlaceSelect?: (place: LocationResult) => void;
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
}: MobileHeaderProps) {
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);

  return (
    <>
      <div className="grid w-full min-w-0 grid-cols-[1fr_auto] items-center gap-x-2 gap-y-3 lg:hidden">
        <Link
          href="/"
          aria-label="Refill Spot 홈"
          className="flex h-11 w-fit items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <BrandMark size={32} className="shrink-0" />
          <span className="flex flex-col">
            <span className="whitespace-nowrap text-lg font-semibold leading-6 tracking-tight text-foreground">
              Refill Spot
            </span>
            <span className="text-[10px] leading-4 text-muted-foreground">
              무한리필 식당 안내
            </span>
          </span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="메뉴 열기"
              onClick={onMenuClick}
              className="mr-20 h-11 w-11 text-muted-foreground hover:text-foreground"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/map" className="flex min-h-11 w-full items-center">
                <Map className="mr-2 h-4 w-4" aria-hidden="true" />
                지도에서 찾기
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onFilterClick} className="min-h-11">
              <Filter className="mr-2 h-4 w-4" aria-hidden="true" />
              검색 필터
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={onLocationDialogOpen}
              className="min-h-11"
            >
              <MapPin className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {currentLocationInfo
                  ? `${currentLocationInfo.address} (${currentLocationInfo.distance}km)`
                  : "검색 위치 설정"}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/guide" className="flex min-h-11 w-full items-center">
                <Info className="mr-2 h-4 w-4" aria-hidden="true" />
                이용 가이드
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/announcements"
                className="flex min-h-11 w-full items-center"
              >
                <Bell className="mr-2 h-4 w-4" aria-hidden="true" />
                공지사항
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/contact"
                className="flex min-h-11 w-full items-center"
              >
                <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                문의하기
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          onClick={() => setIsSearchDialogOpen(true)}
          aria-label="지역, 역 이름, 가게 이름 검색 열기"
          aria-haspopup="dialog"
          aria-expanded={isSearchDialogOpen}
          className="col-span-2 h-11 w-full min-w-0 justify-start gap-2 border-input bg-background px-3 text-muted-foreground hover:text-foreground"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="truncate">지역 · 역 · 가게 검색</span>
        </Button>
      </div>

      <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
        <DialogContent className="w-[calc(100%_-_2rem)] rounded-md border-border bg-card sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle>지역 · 역 · 가게 검색</DialogTitle>
            <DialogDescription>
              지역, 역 이름, 가게 이름이나 주소로 주변 무한리필 가게를 찾으세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <SearchInput
              onPlaceSelect={(place) => {
                onPlaceSelect?.(place);
                setIsSearchDialogOpen(false);
              }}
              placeholder="지역, 역 이름, 가게 이름 검색"
            />
            <Button
              variant="ghost"
              onClick={() => {
                setIsSearchDialogOpen(false);
                onLocationDialogOpen();
              }}
              className="h-11 w-full justify-start px-0 text-muted-foreground hover:text-foreground"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              위치와 검색 반경 설정
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LocationDialog
        isOpen={isLocationDialogOpen}
        onClose={onLocationDialogClose}
        onCustomLocationSet={onCustomLocationSet}
      />
    </>
  );
}
