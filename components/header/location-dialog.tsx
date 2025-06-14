"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useLocationSearch } from "@/hooks/use-location-search";
import { Loader2, MapPin, Navigation } from "lucide-react";
import { useState } from "react";
import { PopularLocations } from "./popular-locations";
import { SearchInput } from "./search-input";

interface LocationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomLocationSet?: (lat: number, lng: number, radius: number) => void;
}

export function LocationDialog({
  isOpen,
  onClose,
  onCustomLocationSet,
}: LocationDialogProps) {
  const [isUsingCurrentLocation, setIsUsingCurrentLocation] = useState(false);

  const { getLocationQuick } = useGeolocation();

  const {
    selectedPlace,
    radiusInput,
    isLoading,
    handlePlaceSelect,
    handlePopularLocationSelect,
    handleManualSearch,
    setSelectedPlace,
    setRadiusInput,
  } = useLocationSearch({
    onCustomLocationSet,
    onDialogClose: onClose,
  });

  const handleCurrentLocationClick = async () => {
    setIsUsingCurrentLocation(true);
    try {
      const position = await getLocationQuick();
      if (position && onCustomLocationSet) {
        onCustomLocationSet(position.lat, position.lng, radiusInput);
        onClose();
      }
    } catch (error) {
      console.error("현재 위치 가져오기 실패:", error);
    } finally {
      setIsUsingCurrentLocation(false);
    }
  };

  const handleDialogClose = () => {
    setSelectedPlace(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <MapPin className="h-5 w-5" />
            <span>위치 설정</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 현재 위치 사용 */}
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={handleCurrentLocationClick}
              disabled={isUsingCurrentLocation}
            >
              {isUsingCurrentLocation ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4 mr-2" />
              )}
              현재 위치 사용
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                또는
              </span>
            </div>
          </div>

          {/* 지역 검색 */}
          <div className="space-y-3">
            <Label htmlFor="location-search">지역 검색</Label>
            <SearchInput
              onPlaceSelect={handlePlaceSelect}
              onManualSearch={handleManualSearch}
              placeholder="지역, 주소를 입력하세요"
            />
          </div>

          {/* 검색 반경 설정 */}
          <div className="space-y-2">
            <Label htmlFor="radius">검색 반경 (km)</Label>
            <div className="flex space-x-2">
              {[1, 3, 5, 10, 20].map((radius) => (
                <Button
                  key={radius}
                  type="button"
                  variant={radiusInput === radius ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRadiusInput(radius)}
                  className="flex-1"
                >
                  {radius}km
                </Button>
              ))}
            </div>
            <div className="flex items-center space-x-2">
              <Input
                id="radius"
                type="number"
                min="1"
                max="50"
                value={radiusInput}
                onChange={(e) => setRadiusInput(Number(e.target.value) || 5)}
                className="w-20"
              />
              <span className="text-sm text-gray-500">km</span>
            </div>
          </div>

          {/* 인기 지역 */}
          <PopularLocations onLocationSelect={handlePopularLocationSelect} />

          {/* 선택된 장소 표시 */}
          {selectedPlace && (
            <div className="p-3 bg-gray-50 rounded-md">
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-blue-600" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    선택된 위치: {selectedPlace.description}
                  </div>
                  <div className="text-xs text-gray-500">
                    반경: {radiusInput}km
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 로딩 상태 */}
          {isLoading && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-sm text-gray-600">
                위치를 설정하는 중...
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
